'use strict';
// Agent Runtime (spec §7, §27). Roda um agente: o modelo pede ferramentas, o runtime
// confere se o agente pode pedi-las, executa pelo Tool Gateway (que aplica política,
// registra no Vault e põe na fila de aprovação) e devolve o resultado ao modelo, até o
// agente responder sem pedir ferramenta, ficar esperando aprovação ou estourar o orçamento.
//
// Erros (spec §27): falha de ferramenta vira resultado estruturado para o modelo; erro
// transitório (UPSTREAM) é repetido uma vez antes; erro de modelo repete uma vez e depois
// tenta o próximo modelo candidato (ADR-FREE-05: regra por tipo de falha em classify()). Nada é dado
// como feito sem confirmação da ferramenta.
const { allowed, systemPrompt, AGENTS } = require('./agents');
const { candidates } = require('./models');
const { parseEditBlocks, FORMAT_HELP } = require('./edit-blocks');

const RETRYABLE_TOOL = new Set(['UPSTREAM']);
// Resultado de ferramenta que volta ao modelo. Grande o bastante para um arquivo de código inteiro
// (cortar arquivo levava o agente a reescrever o que não leu); o orçamento de tokens segue valendo.
const RESULT_MAX = 60000;
const wait = ms => new Promise(r => setTimeout(r, ms));
/** "Please try again in 7.5s" / "in 1m2s" (Groq, OpenRouter) / "Please retry in 41s" (Google) → ms; sem dica, 10 s. */
function retryAfterMs(text) {
  const m = /(?:try again|retry) in (?:(\d+)m)?([\d.]+)?s?/i.exec(String(text || ''));
  if (!m || (!m[1] && !m[2])) return 10000;
  return Math.ceil(((Number(m[1]) || 0) * 60 + (Number(m[2]) || 0)) * 1000) + 500;
}
// Em plano grátis cada pedido grande gasta quase a cota do minuto: o agente espera quantas vezes precisar,
// dentro do orçamento de tempo da execução (meter.check()).
const RATE_ROUNDS = 20;

/**
 * ADR-FREE-05: tipo de falha de modelo → o que fazer.
 *   too_large  pedido maior que o teto POR PEDIDO do modelo (GitHub Models "tokens_limit_reached"): pula o modelo
 *   tpm        413 da Groq (pedido maior que a cota por MINUTO): encolhe a resposta e o histórico, mesmo modelo
 *   rate       429 por minuto: espera e repete uma vez (no Kilo, cota por IP: vai direto ao próximo)
 *   daily      429 da cota do DIA: pula o modelo nesta execução
 *   busy       503 "high demand" / overloaded / 5xx: próximo modelo na hora, sem repetir
 *   transient  rede ou tempo esgotado: repete uma vez
 *   fatal      400/401/403/404 (modelo saiu, chave ruim): pula o modelo nesta execução
 */
function classify(e) {
  const code = e && e.code;
  const d = (e && e.details) || {};
  const s = Number(d.status) || 0;
  const up = String(d.upstream || '');
  if (code === 'TOO_LARGE' || (s === 413 && /tokens_limit_reached|body too large|max(imum)? size/i.test(up))
    || (s === 400 && /context.length|maximum context|too many tokens|tokens_limit_reached/i.test(up))) return 'too_large';
  if (s === 413) return 'tpm';
  if (s === 429) return /per.?day|\b(RPD|TPD)\b|daily/i.test(up) ? 'daily' : 'rate';
  if (s >= 500 || /high demand|overloaded|over capacity|unavailable/i.test(up)) return 'busy';
  if (s >= 400) return 'fatal';
  if (code === 'UPSTREAM' || code === 'ABORTED') return 'transient';
  return 'fatal';
}
const SKIP = new Set(['too_large', 'daily', 'fatal']);   // não adianta tentar de novo nesta execução

/**
 * Troca de modelo com as regras acima (runAgent e askModel). `fail(e)` devolve null quando é para tentar
 * de novo (com `desc`/`shrink` atualizados) ou { code } quando todos falharam. Quando o fim da lista chega
 * com algum 429 de cota por minuto, espera a janela virar e recomeça (até RATE_ROUNDS vezes).
 */
function createFailover(models, meter) {
  let mi = 0, rounds = 0, tries = 0, shrink = 0, sawRate = false, hint = '', lastLive = null, lastCode = null;
  const skip = new Set();
  const errors = [];
  const nextLive = from => { for (let i = from; i < models.length; i++) if (!skip.has(i)) return i; return -1; };
  return {
    errors,
    get desc() { return models[mi]; },
    get shrink() { return shrink; },
    ok() { tries = 0; },
    /** Troca já para o próximo modelo vivo (de preferência de outro provedor); false se não houver outro. */
    switchModel() {
      const cur = models[mi];
      skip.add(mi);
      let n = -1;
      for (let k = 1; k < models.length; k++) { const j = (mi + k) % models.length; if (!skip.has(j) && models[j].provider !== cur.provider) { n = j; break; } }
      if (n < 0) n = nextLive(0);
      if (n < 0) { skip.delete(mi); return false; }
      mi = n; tries = 0; return true;
    },
    async fail(e) {
      const desc = models[mi];
      const code = e && e.code;
      const d = (e && e.details) || {};
      const real = d.model && d.model !== desc.model ? ` (${d.model})` : '';
      errors.push(`${desc.provider}/${desc.model}${real}: ${String((e && e.message) || code || 'erro')}${d.upstream ? ` ${String(d.upstream).replace(/\s+/g, ' ').slice(0, 160)}` : ''}`);
      const kind = classify(e);
      lastCode = code;
      if (!SKIP.has(kind)) lastLive = code;
      if (kind === 'tpm' && shrink < 2) { shrink++; return null; }
      if (kind === 'rate') {
        sawRate = true; hint = d.upstream;
        if (tries === 0 && desc.provider !== 'kilo') { tries++; await wait(Math.min(retryAfterMs(d.upstream), 30000)); return null; }
      }
      if (kind === 'transient' && tries === 0) { tries++; return null; }
      if (SKIP.has(kind)) skip.add(mi);
      tries = 0;
      const n = nextLive(mi + 1);
      if (n >= 0) { mi = n; return null; }
      // Fim da lista com cota por minuto estourada (planos grátis): espera a janela e recomeça.
      if (sawRate && rounds < RATE_ROUNDS) {
        rounds++; sawRate = false;
        await wait(Math.min(Math.max(retryAfterMs(hint), 5000), 60000));
        meter.check();
        const f = nextLive(0);
        if (f >= 0) { mi = f; return null; }
      }
      const c = lastLive || lastCode;
      return { code: c && /^[A-Z_]+$/.test(c) ? `MODEL_${c}` : 'MODEL_ERROR' };
    },
  };
}
const ANSWER_CODES = new Set(['NOT_FOUND', 'UPSTREAM_NOT_FOUND']);
// Planos grátis limitam tokens por minuto: resultados de ferramenta antigos (já usados pelo
// modelo) seguem só no começo. ADR-CORTEX-01: arquivos lidos são a exceção — o agente precisa do
// texto exato para editar. Vale a leitura mais recente de cada caminho, inteira, até FILE_BUDGET
// caracteres (metade a cada nível de 413); leituras repetidas e leituras anteriores a uma gravação
// do mesmo arquivo viram uma nota curta. Sem isso o modelo perdia o arquivo e relia em loop.
const OLD_RESULT_MAX = 1500;
const FILE_BUDGET = 48000;   // ~12 mil tokens de arquivos inteiros no histórico
const RESULT_HEAD = 'RESULTADO DAS FERRAMENTAS (JSON):\n';
const capResult = body => (body.length > RESULT_MAX ? `${body.slice(0, RESULT_MAX)}…[cortado]` : body);
const isFile = r => !!(r && r.ok && r.tool === 'github.get_file' && r.result && typeof r.result.content === 'string' && typeof r.result.path === 'string');
function compact(messages, level = 0) {
  const max = level ? Math.max(400, OLD_RESULT_MAX >> level) : OLD_RESULT_MAX;
  const idx = messages.map((m, i) => (m.role === 'user' && typeof m.content === 'string' && m.content.startsWith('RESULTADO DAS FERRAMENTAS') ? i : -1)).filter(i => i >= 0);
  const last = idx[idx.length - 1];
  // Histórico sem os resultados estruturados (formato antigo): os 2 mais recentes inteiros (1 no nível 1+).
  const legacyOld = new Set(idx.filter(i => !Array.isArray(messages[i]._results)).slice(0, -(level ? 1 : 2)));
  let budget = FILE_BUDGET >> level;
  const seen = new Set();      // caminhos já mantidos numa leitura mais nova
  const written = new Set();   // caminhos gravados depois (mais para baixo no histórico)
  const out = messages.slice();
  for (let j = idx.length - 1; j >= 0; j--) {
    const i = idx[j];
    const m = messages[i];
    if (!Array.isArray(m._results)) {
      if (legacyOld.has(i) && m.content.length > max) out[i] = { ...m, content: `${m.content.slice(0, max)}…[resultado antigo resumido; peça de novo a ferramenta se precisar]` };
      continue;
    }
    const parts = new Array(m._results.length);
    for (let k = m._results.length - 1; k >= 0; k--) {
      const r = m._results[k];
      if (r && r.ok && Array.isArray(r.paths)) for (const p of r.paths) written.add(p);
      if (isFile(r)) {
        const p = r.result.path;
        const note = seen.has(p) ? '[mesmo arquivo lido de novo mais abaixo; use a leitura mais recente]'
          : written.has(p) ? '[desatualizado: o arquivo foi alterado depois desta leitura; leia de novo na branch]' : null;
        seen.add(p);
        if (note) { parts[k] = { ...r, result: { ...r.result, content: note } }; continue; }
        const len = r.result.content.length;
        if (i === last || len <= budget) { budget -= len; parts[k] = r; continue; }
        parts[k] = { ...r, result: { ...r.result, content: `${r.result.content.slice(0, max)}…[cortado para caber na cota; peça github.get_file de novo se precisar]` } };
        continue;
      }
      const t = JSON.stringify(r);
      parts[k] = i !== last && t.length > max ? { tool: r && r.tool, ok: r && r.ok, resumo: `${t.slice(0, max)}…[resultado antigo resumido]` } : r;
    }
    out[i] = { role: m.role, content: `${RESULT_HEAD}${capResult(JSON.stringify(parts))}` };
  }
  return out;
}
const toModelName = n => n.replace(/\./g, '__');
const fromModelName = n => String(n).replace(/__/g, '.');

/** Ferramenta local (não passa pelo gateway) para Reviewer e Security devolverem veredito estruturado. */
const REPORT_TOOL = {
  name: 'report_findings',
  description: 'Encerra a revisão com o veredito e os problemas encontrados (arquivo, severidade, motivo).',
  input_schema: { type: 'object', required: ['verdict', 'findings'], properties: {
    verdict: { type: 'string', enum: ['approve', 'changes_requested'] },
    findings: { type: 'array', items: { type: 'object', required: ['severity', 'message'], properties: {
      severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }, file: { type: 'string' }, message: { type: 'string' } } } },
  } },
};
const REPORTING_AGENTS = new Set(['reviewer', 'security']);
const VERDICT_HELP = 'Você terminou a revisão sem o veredito. Chame agora report_findings com verdict e findings. '
  + 'Se a chamada de ferramenta falhar, responda SÓ com este JSON: {"verdict":"approve","findings":[]} '
  + '(ou "changes_requested" com cada problema em findings: {"severity":"high","file":"caminho","message":"o que corrigir"}).';
/** Veredito em JSON escrito no texto ({"verdict": ..., "findings": [...]}), ou null. */
function verdictInText(text) {
  const t = String(text || '');
  for (let i = t.indexOf('{'); i >= 0; i = t.indexOf('{', i + 1)) {
    if (!/^\{\s*"verdict"/.test(t.slice(i))) continue;
    for (let j = t.lastIndexOf('}'); j > i; j = t.lastIndexOf('}', j - 1)) {
      try {
        const v = JSON.parse(t.slice(i, j + 1));
        if (v && ['approve', 'changes_requested'].includes(v.verdict) && Array.isArray(v.findings)) {
          return { verdict: v.verdict, findings: v.findings.filter(f => f && typeof f.message === 'string').slice(0, 50) };
        }
      } catch { /* tenta um fecho mais curto */ }
    }
  }
  return null;
}
const WRITE_TOOLS = new Set(['github.commit_files', 'github.edit_files']);
// Modelos grátis às vezes "respondem" com o código no texto e encerram sem salvar. Quem pode gravar
// e ainda não gravou nada recebe até MAX_NUDGES lembretes com um exemplo concreto, e o texto com
// blocos de edição é aplicado pelo runtime (ADR-CORTEX-01) em vez de terminar vazio.
const MAX_NUDGES = 2;
const LAST_STEPS = branch => `ATENÇÃO: restam 2 passos. Pare de ler arquivos e grave agora o que já tem com github.edit_files (ou github.commit_files) na branch ${branch}; uma mudança parcial gravada vale mais que nenhuma.`;
function nudgeSave(branch, n, cut) {
  const b = branch || 'nexia/...';
  const example = JSON.stringify({ branch: b, message: 'Descreve a mudança', edits: [{ path: 'caminho/do/arquivo.tsx', find: 'trecho exato copiado do arquivo', replace: 'trecho novo' }] });
  return [
    cut ? 'Sua resposta foi cortada pelo limite de tokens antes de terminar. Mande menos de cada vez: trechos "find" curtos e únicos, um arquivo por chamada.' : 'Você terminou sem salvar nada na branch. Texto solto não conta.',
    `Chame agora github.edit_files (arquivo existente) assim: ${example}`,
    'ou github.commit_files (arquivo novo, conteúdo completo).',
    `${n > 1 ? 'Última chance: ' : ''}se a chamada de ferramenta falhar, responda SÓ com blocos neste formato (o NEXIA aplica por você na branch ${b}):\n${FORMAT_HELP}`,
  ].join('\n');
}
/** Texto do resultado: começo e fim (o fim do Architect traz a lista de ARQUIVOS). */
const clip = (t, n = 2000) => { const s = String(t || ''); return s.length <= n ? s : `${s.slice(0, Math.max(0, n - 520))}\n…\n${s.slice(-500)}`; };
/** Argumentos que não eram JSON válido (o provedor devolve { _raw }): tenta limpar cercas e vírgulas sobrando. */
function repairRaw(raw) {
  const t = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').replace(/,\s*([}\]])/g, '$1');
  try { const v = JSON.parse(t); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch { return null; }
}
const writtenPaths = (name, input) => (name === 'github.edit_files' ? (input.edits || []).map(e => e && e.path)
  : name === 'github.commit_files' ? (input.files || []).map(f => f && f.path) : []).filter(p => typeof p === 'string');

class BudgetError extends Error { constructor(what) { super(`Orçamento estourado: ${what}.`); this.code = 'BUDGET_EXCEEDED'; } }

/**
 * Orçamento compartilhado pela execução inteira.
 * @param {{ max_steps, max_tool_calls, max_tokens, max_ms }} budget
 */
function createMeter(budget, now = () => Date.now()) {
  const t0 = now();
  const usage = { steps: 0, tool_calls: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0, cost_known: true, models: new Set() };
  return {
    usage,
    check() {
      if (usage.steps >= budget.max_steps) throw new BudgetError('passos de modelo');
      if (usage.tool_calls >= budget.max_tool_calls) throw new BudgetError('chamadas de ferramenta');
      if (usage.input_tokens + usage.output_tokens >= budget.max_tokens) throw new BudgetError('tokens');
      if (now() - t0 >= budget.max_ms) throw new BudgetError('tempo');
    },
    elapsed: () => now() - t0,
  };
}

/**
 * @param {object} o
 * @param {string} o.agentId
 * @param {string} o.goal              tarefa do passo (texto do Orchestrator)
 * @param {string} [o.context]         contexto do projeto (Context Engine)
 * @param {object} o.router            Model Router
 * @param {object} o.gateway           Tool Gateway
 * @param {object} o.ctx               contexto de execução (ator = o agente)
 * @param {string} o.projectId
 * @param {object} o.meter             createMeter(...)
 * @param {string} [o.branch]          branch de trabalho "nexia/..." (blocos de edição em texto vão para ela)
 * @param {string[]} [o.preload]       arquivos lidos pelo gateway antes do 1º turno (até 4)
 * @param {string} [o.ref]             ref das leituras pré-carregadas
 * @param {number} [o.rotate]          começa pelo n-ésimo modelo candidato (troca de modelo grátis em falha repetida)
 * @returns {Promise<{ status: 'done'|'waiting_approval'|'failed', text?, report?, tool_call_ids, model?, error_code?, pending? }>}
 */
async function runAgent(o) {
  const agent = AGENTS[o.agentId];
  // o.rotate: rodada de correção repetida (issue #234) começa por outro modelo grátis da lista.
  const all = candidates(o.router, agent.model);
  const rot = all.length ? (Math.max(0, o.rotate | 0) % all.length) : 0;
  const models = [...all.slice(rot), ...all.slice(0, rot)];
  const toolCallIds = [];
  if (!models.length) return { status: 'failed', error_code: 'NO_MODEL', text: 'Nenhum modelo com tool_call configurado (ex.: ANTHROPIC_API_KEY).', tool_call_ids: toolCallIds };

  const catalog = o.gateway.describe().filter(t => allowed(o.agentId, t.name));
  const tools = catalog.map(t => ({ name: toModelName(t.name), description: `[${t.risk}] ${t.description}`, input_schema: t.input_schema }));
  if (REPORTING_AGENTS.has(o.agentId)) tools.push(REPORT_TOOL);
  const system = systemPrompt(o.agentId, o.context);
  const messages = [{ role: 'user', content: o.goal }];
  const failures = new Map();
  const canWrite = catalog.some(t => WRITE_TOOLS.has(t.name));
  let wrote = false;
  let nudges = 0;
  let verdictNudges = 0;
  const applied = new Set();   // blocos de texto já enviados ao gateway
  const branch = o.branch || ((/Branch de trabalho: (nexia\/\S+)/.exec(o.goal || '') || [])[1]) || null;
  const localErrors = [];   // gravações recusadas (diagnóstico no resumo do passo quando nada foi gravado)
  const fo = createFailover(models, o.meter);   // shrink 0: 8192 tokens de resposta; 1: 4096; 2: 2048

  const lastToolFail = { model: null, tool: null, n: 0 };
  const strike = (key, model, code, text) => {
    const n = (failures.get(key) || 0) + 1;
    failures.set(key, n);
    return n >= 3 ? { stop: { status: 'failed', error_code: code, text, tool_call_ids: toolCallIds, model } } : null;
  };
  // Depois de editar (ou de um trecho que não bateu), o modelo recebe o arquivo como está agora na
  // branch: a cópia antiga no contexto deixa de valer e o próximo "find" sai do texto atual.
  const refresh = async (input, results) => {
    if (!allowed(o.agentId, 'github.get_file')) return;
    const paths = [...new Set(writtenPaths('github.edit_files', input))].slice(0, 3);
    for (const path of paths) {
      try {
        const g = await o.gateway.invoke(o.ctx, { projectId: o.projectId, tool: 'github.get_file', input: { path, ref: input.branch } });
        if (g.tool_call) toolCallIds.push(g.tool_call.id);
        if (g.status === 'succeeded') results.push({ tool: 'github.get_file', ok: true, result: g.result, note: 'Conteúdo atual do arquivo na branch, depois da edição. Copie os próximos "find" daqui.' });
      } catch { /* sem cópia nova: o modelo ainda pode pedir github.get_file */ }
    }
  };
  // Executa chamadas pelo Tool Gateway. Devolve { results } ou { stop } (fim do agente).
  const runCalls = async (calls, out, model) => {
    const results = [];
    for (const call of calls) {
      if (call.name === REPORT_TOOL.name && REPORTING_AGENTS.has(o.agentId)) {
        const r = call.input || {};
        if (!['approve', 'changes_requested'].includes(r.verdict) || !Array.isArray(r.findings)) { results.push({ tool: call.name, error: 'INVALID_INPUT' }); continue; }
        return { stop: { status: 'done', report: { verdict: r.verdict, findings: r.findings.slice(0, 50) }, text: String(out.text || '').slice(0, 2000), tool_call_ids: toolCallIds, model } };
      }
      const name = fromModelName(call.name);
      if (!allowed(o.agentId, name)) { results.push({ tool: name, error: 'TOOL_NOT_ALLOWED', message: `O agente ${agent.title} não usa ${name}.` }); continue; }
      let input = call.input || {};
      // Argumentos que não eram JSON (resposta cortada pelo limite de tokens, aspas sem escape): o erro
      // volta ao modelo com o que fazer, em vez de um INVALID_INPUT sem explicação.
      if (input && typeof input === 'object' && '_raw' in input) {
        const fixed = repairRaw(input._raw);
        if (fixed) input = fixed;
        else {
          const cut = out.stop_reason === 'length' || out.stop_reason === 'max_tokens';
          results.push({ tool: name, ok: false, error: 'INVALID_JSON', message: `Os argumentos de ${name} não eram JSON válido${cut ? ' (a resposta foi cortada pelo limite de tokens)' : ''}. `
            + `Mande menos trechos por chamada (find curto e único) e escape aspas e quebras de linha, ou responda com blocos de texto:\n${FORMAT_HELP}` });
          localErrors.push(`${name}: INVALID_JSON`);
          const s = strike(`${name}:INVALID_JSON`, model, 'INVALID_JSON', `A ferramenta ${name} recebeu JSON inválido 3 vezes.`);
          if (s) return s;
          continue;
        }
      }
      o.meter.check();
      let r;
      for (let attempt = 0; attempt < 2; attempt++) {
        o.meter.usage.tool_calls++;
        try {
          r = await o.gateway.invoke(o.ctx, { projectId: o.projectId, tool: name, input });
        } catch (e) {
          // Entrada recusada pelo schema antes do registro no Vault: o modelo precisa saber qual campo errou.
          const problems = e && e.details && Array.isArray(e.details.problems) ? ` ${e.details.problems.slice(0, 5).join('; ')}` : '';
          r = { status: 'failed', error: { code: (e && e.code) || 'TOOL_ERROR', message: `${(e && e.message) || 'erro'}${problems}` } };
        }
        if (r.tool_call) toolCallIds.push(r.tool_call.id);
        if (r.status === 'failed' && RETRYABLE_TOOL.has(r.error && r.error.code) && attempt === 0) continue;
        break;
      }
      if (r.status === 'pending_approval') {
        return { stop: { status: 'waiting_approval', pending: { tool: name, tool_call_id: r.tool_call.id, reason: r.reason }, tool_call_ids: toolCallIds, model,
          text: `Aguardando aprovação humana para ${name} (${r.reason}).` } };
      }
      if (r.status === 'succeeded') {
        results.push({ tool: name, ok: true, result: r.result, ...(WRITE_TOOLS.has(name) ? { paths: writtenPaths(name, input) } : {}) });
        if (WRITE_TOOLS.has(name)) wrote = true;
        for (const k of [...failures.keys()]) if (k.startsWith(`${name}:`)) failures.delete(k);
        if (lastToolFail.tool === name) lastToolFail.n = 0;   // progresso zera as falhas da ferramenta
        if (name === 'github.edit_files') await refresh(input, results);
        continue;
      }
      const code = (r.error && r.error.code) || (r.status === 'denied' ? 'POLICY_DENIED' : 'TOOL_ERROR');
      results.push({ tool: name, ok: false, error: code, message: r.error ? r.error.message : r.reason });
      if (name === 'github.edit_files' && code === 'INVALID_INPUT') await refresh(input, results);
      if (WRITE_TOOLS.has(name)) localErrors.push(`${name}: ${code}${r.error && r.error.message ? ` (${String(r.error.message).slice(0, 160)})` : ''}`);
      if (ANSWER_CODES.has(code)) continue;   // "não existe" é resposta (ex.: conferir se o arquivo novo já existe), não falha
      // Issue #221: o mesmo modelo errando a mesma ferramenta 2 vezes seguidas troca já de provedor grátis.
      if (model && lastToolFail.model === model && lastToolFail.tool === name) lastToolFail.n++;
      else Object.assign(lastToolFail, { model, tool: name, n: 1 });
      if (model && lastToolFail.n >= 2 && fo.switchModel()) {
        Object.assign(lastToolFail, { model: null, tool: null, n: 0 });
        failures.delete(`${name}:${code}`);
        results.push({ tool: name, ok: false, error: 'MODEL_SWITCHED', message: `${name} falhou 2 vezes seguidas com ${model}; o NEXIA trocou de modelo.` });
        continue;
      }
      const s = strike(`${name}:${code}`, model, code, `A ferramenta ${name} falhou 3 vezes (${code}${r.error && r.error.message ? `: ${String(r.error.message).slice(0, 200)}` : ''}).`);   // por ferramenta
      if (s) return s;
    }
    return { results };
  };
  const pushResults = (assistantText, names, results) => {
    messages.push({ role: 'assistant', content: `${assistantText ? `${assistantText}\n` : ''}[ferramentas pedidas: ${names.join(', ')}]` });
    messages.push({ role: 'user', content: `${RESULT_HEAD}${capResult(JSON.stringify(results))}`, _results: results });
  };

  // Arquivos citados no pedido e na análise: lidos antes do 1º turno (economiza passos e cota).
  if (Array.isArray(o.preload) && o.preload.length && allowed(o.agentId, 'github.get_file')) {
    const calls = o.preload.slice(0, 4).map((p, k) => ({ id: `preload_${k}`, name: toModelName('github.get_file'), input: { path: p, ...(o.ref ? { ref: o.ref } : {}) } }));
    const r = await runCalls(calls, {}, null);
    if (r.stop) return r.stop;
    pushResults('Lendo os arquivos citados no pedido (pré-carregados pelo NEXIA).', calls.map(() => 'github.get_file'), r.results);
  }

  for (let turn = 0; turn < (agent.max_steps || 8); turn++) {
    o.meter.check();
    let out;
    let desc;
    for (;;) {
      desc = fo.desc;
      try {
        out = await o.router.toolCall(desc, { system, messages: compact(messages, fo.shrink), tools, maxTokens: Math.max(2048, 8192 >> fo.shrink) });
        fo.ok();
        break;
      } catch (e) {
        const end = await fo.fail(e);
        if (end) return { status: 'failed', error_code: end.code, text: `O modelo não respondeu. ${fo.errors.slice(-3).join(' | ')}`.slice(0, 1500), tool_call_ids: toolCallIds };
      }
    }
    const model = usedModel(desc, out);
    o.meter.usage.models.add(model);
    o.meter.usage.steps++;
    const u = out.usage || {};
    o.meter.usage.input_tokens += u.input_tokens || 0;
    o.meter.usage.output_tokens += u.output_tokens || 0;
    const cost = o.router.costEstimate ? o.router.costEstimate(desc, u) : { known: false };
    if (cost && cost.known) o.meter.usage.cost_usd += cost.usd; else o.meter.usage.cost_known = false;

    let calls = out.tool_calls || [];
    let viaText = false;
    // ADR-CORTEX-01: sem chamada de ferramenta, blocos de edição no texto viram github.edit_files /
    // github.commit_files na branch de trabalho, pelo gateway (política, Vault e aprovação valem igual).
    if (!calls.length && canWrite && branch) {
      const blocks = parseEditBlocks(out.text);
      // O resumo final costuma repetir os blocos já aplicados: esses não vão de novo.
      blocks.edits = blocks.edits.filter(e => !applied.has(JSON.stringify([e.path, e.find, e.replace])));
      if (wrote) blocks.files = [];   // depois de gravar, arquivo inteiro no texto é só ilustração
      const list = ps => [...new Set(ps)].slice(0, 3).join(', ');
      if (blocks.edits.length) calls.push({ id: 'text_edit', name: toModelName('github.edit_files'), input: { branch, message: `${agent.title}: edição proposta em texto (${list(blocks.edits.map(e => e.path))})`, edits: blocks.edits.slice(0, 40) } });
      if (blocks.files.length) calls.push({ id: 'text_commit', name: toModelName('github.commit_files'), input: { branch, message: `${agent.title}: arquivos propostos em texto (${list(blocks.files.map(f => f.path))})`, files: blocks.files.slice(0, 20) } });
      calls = calls.filter(c => allowed(o.agentId, fromModelName(c.name)));
      viaText = calls.length > 0;
      if (!viaText && blocks.problems.length) localErrors.push(`texto: ${blocks.problems.slice(0, 2).join('; ')}`);
    }
    if (!calls.length && canWrite && !wrote && nudges < MAX_NUDGES) {
      nudges++;
      messages.push({ role: 'assistant', content: String(out.text || '(sem texto)').slice(0, 4000) });
      messages.push({ role: 'user', content: nudgeSave(branch, nudges, out.stop_reason === 'length' || out.stop_reason === 'max_tokens') });
      continue;
    }
    // Reviewer/Security que terminam só com texto: o veredito pode vir em JSON no texto; se não vier,
    // até 2 lembretes para chamar report_findings (antes, virava changes_requested sem motivo).
    if (!calls.length && REPORTING_AGENTS.has(o.agentId)) {
      const report = verdictInText(out.text);
      if (report) return { status: 'done', report, text: clip(out.text, 2000), tool_call_ids: toolCallIds, model };
      if (verdictNudges < MAX_NUDGES) {
        verdictNudges++;
        messages.push({ role: 'assistant', content: String(out.text || '(sem texto)').slice(0, 4000) });
        messages.push({ role: 'user', content: VERDICT_HELP });
        continue;
      }
    }
    if (!calls.length) {
      const why = canWrite && !wrote && localErrors.length ? `\n[nada gravado; recusas: ${[...new Set(localErrors)].slice(-4).join(' | ')}]`.slice(0, 700) : '';
      return { status: 'done', text: `${clip(out.text, 2000 - why.length)}${why}`, tool_call_ids: toolCallIds, model };
    }

    const r = await runCalls(calls, out, model);
    if (r.stop) return r.stop;
    if (viaText) for (const e of (calls.find(c => c.id === 'text_edit') || { input: { edits: [] } }).input.edits) applied.add(JSON.stringify([e.path, e.find, e.replace]));
    // Perto do limite de passos sem nada gravado (MAX_STEPS/NO_CHANGES): pede para gravar já o que tem.
    const maxSteps = agent.max_steps || 8;
    if (canWrite && branch && !wrote && maxSteps >= 4 && turn === maxSteps - 3) r.results.push({ tool: 'nexia.aviso', ok: true, note: LAST_STEPS(branch) });
    pushResults(viaText ? `${String(out.text || '').slice(0, 1500)}\n[o NEXIA aplicou os blocos de edição do texto]` : out.text, calls.map(c => fromModelName(c.name)), r.results);
  }
  return { status: 'failed', error_code: 'MAX_STEPS', text: `O agente ${agent.title} não terminou dentro do limite de passos.`, tool_call_ids: toolCallIds };
}

/**
 * Uma resposta de texto, sem ferramentas (ex.: o spec JSON do Site Kit). Mesmas regras de troca de modelo,
 * 413 (menos tokens de resposta) e 429 (espera a janela do minuto) do runAgent.
 * @returns {Promise<{ status: 'done'|'failed', text: string, model?: string, error_code?: string }>}
 */
async function askModel(o) {
  const agent = AGENTS[o.agentId];
  const models = candidates(o.router, agent.model);
  if (!models.length) return { status: 'failed', error_code: 'NO_MODEL', text: 'Nenhum modelo configurado.' };
  const fo = createFailover(models, o.meter);
  for (;;) {
    o.meter.check();
    const desc = fo.desc;
    try {
      const out = await o.router.chat(desc, { system: o.system, messages: [{ role: 'user', content: o.prompt }], maxTokens: Math.max(2048, (o.maxTokens || 6144) >> fo.shrink) });
      const u = out.usage || {};
      o.meter.usage.steps++;
      o.meter.usage.input_tokens += u.input_tokens || 0;
      o.meter.usage.output_tokens += u.output_tokens || 0;
      const cost = o.router.costEstimate ? o.router.costEstimate(desc, u) : { known: false };
      if (cost && cost.known) o.meter.usage.cost_usd += cost.usd; else o.meter.usage.cost_known = false;
      const model = usedModel(desc, out);
      o.meter.usage.models.add(model);
      return { status: 'done', text: String(out.text || ''), model };
    } catch (e) {
      const end = await fo.fail(e);
      if (end) return { status: 'failed', error_code: end.code, text: `O modelo não respondeu. ${fo.errors.slice(-3).join(' | ')}`.slice(0, 1500) };
    }
  }
}

/** "provedor/modelo" para o registro; no Kilo, "auto:N" vira o nome real que o gateway usou. */
function usedModel(desc, out) {
  const real = /^auto:\d+$/.test(desc.model) && out && typeof out.model === 'string' && out.model ? out.model : desc.model;
  return `${desc.provider}/${real}`;
}

module.exports = { askModel, verdictInText, classify, compact, runAgent, createMeter, BudgetError, toModelName, fromModelName, REPORT_TOOL };
