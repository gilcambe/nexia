'use strict';
// NEXIA Orchestrator (spec §6 "Fluxo de cada solicitação", §7, §16, §22, §27).
//   INPUT → intenção → cliente/projeto → contexto do Vault → plano → permissões (Policy
//   Engine, via Tool Gateway) → agentes/ferramentas → testes (gates) → revisão →
//   commit/PR/deploy conforme política → registro no Vault (Execution) → resposta com evidências.
//
// O Orchestrator não codifica: as mudanças de código são dos agentes. Passos mecânicos
// (criar branch, abrir PR, disparar staging, ler checks) são feitos direto pelo Tool
// Gateway, porque não precisam de modelo e assim ficam determinísticos.
// Nada é declarado concluído sem os gates com evidência; a execução fica "running"
// enquanto o CI roda e é reavaliada por refresh().
const crypto = require('crypto');
const { resolveProject } = require('../project-resolver');
const { buildContext } = require('../context-engine');
const { runAgent, askModel, createMeter } = require('./runtime');
const kit = require('../site-kit');
const cloner = require('../cloner');
const { WEB, checkWebFiles, fmt } = require('./web-check');
const { evaluateGates, verdict } = require('./gates');
const { normalize } = require('../text');
const { redactSecrets } = require('../vault/secrets');

const DEFAULT_BUDGET = Object.freeze({ max_steps: 80, max_tool_calls: 160, max_tokens: 2000000, max_ms: 30 * 60 * 1000 });
// ADR-Q-01: quando Reviewer ou Security pedem mudanças, o agente que implementou corrige na mesma
// branch e a revisão roda de novo, até este limite. Depois disso a execução falha como antes.
const MAX_FIX_ROUNDS = 2;
const FINAL = ['succeeded', 'failed', 'cancelled'];
// ADR-FREE-04: erros de IA que são falta de cota/fora do ar (não configuração) e quantas esperas cabem.
const AI_WAIT = /^MODEL_(UPSTREAM|ABORTED|ERROR|RATE_LIMIT\w*|OVERLOADED)$/;
const AI_WAITS = 9;

// ── Intenção ─────────────────────────────────────────────────────────────────
// Classificador por regras (determinístico e auditável). Ordem importa.
const INTENT_RULES = [
  ['deploy_production', /\b(produc[aã]o|production|prod)\b/],
  ['deploy_staging', /\b(staging|homologa[cç][aã]o)\b/],
  ['pipeline', /\b(pipeline|ci ?\/ ?cd|github actions|workflow)\b/],
  ['status', /\b(status|pendente|pendencias|o que mudou|ultimo deploy|quais|liste|mostre|compare|resuma)\b/],
  ['change', /\b(corrij\w*|corrigir|implement\w*|alter\w*|adicion\w*|crie|criar|remov\w*|aument\w*|diminu\w*|mud\w*|ajust\w*|consert\w*|refator\w*|troqu\w*|troca\w*|fix)\b/],
];
// Endereços no pedido (ex.: site de referência) não contam: "https://x.com/workflow" não é pipeline nem "app.x.com" é sistema.
const withoutUrls = message => String(message || '').replace(/\bhttps?:\/\/\S+|\bwww\.\S+/gi, ' ');
function classifyIntent(message) {
  const m = normalize(withoutUrls(message));
  for (const [intent, re] of INTENT_RULES) {
    // Criar site ou sistema ("desenvolva um sistema", "monte uma landing") é mudança, mesmo sem os verbos da regra.
    if (intent === 'status' && buildKind(message)) return 'change';
    if (re.test(m)) return intent;
  }
  return 'question';
}
const wantsStaging = message => /\b(staging|homologa|publiqu\w*|publicar)\b/.test(normalize(message || ''));

/**
 * ADR-Q-03: pedido para CRIAR um site ou sistema com interface → 'site' | 'system' | null.
 * Esses pedidos passam pelo Designer e pela checagem visual obrigatória.
 */
function buildKind(message) {
  const m = normalize(withoutUrls(message));
  // O verbo precisa estar perto do substantivo ("crie um site", "desenvolva o novo painel"): "crie a página de
  // contato do Site Alfa" é mudança num site que já existe, não site novo.
  // ADR-CLONE-01: "clone o site https://..." também cria site novo (só com o design do site de referência).
  const near = nouns => new RegExp(`\\b(cri\\w*|fa(c|z)\\w*|mont\\w*|constru\\w*|ger\\w*|desenvolv\\w*|refa(c|z)\\w*|redesenh\\w*|clon\\w*|replic\\w*)\\s+(\\S+\\s+){0,3}?(${nouns})\\b`).test(m);
  if (near('sistema|painel|dashboard|admin|crm|erp|aplicativo|app|plataforma|portal')) return 'system';
  if (near('site|landing|loja virtual|e-?commerce|portfolio|hotsite')) return 'site';
  return null;
}

function specialistFor(message) {
  const m = normalize(message || '');
  if (buildKind(message) || /\b(botao|tela|css|layout|pagina|formulario|ui|responsiv\w*|componente|estilo|cor|fonte|seo|acessibilidade)\b/.test(m)) return 'frontend';
  if (/\b(firestore|banco|indice|schema|migra\w*|colecao|regras)\b/.test(m)) return 'database';
  if (/\b(api|endpoint|funcao|autentica\w*|webhook|job|backend|servidor)\b/.test(m)) return 'backend';
  return 'coder';
}

const slug = s => normalize(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'tarefa';

/**
 * ADR-CORTEX-01: caminhos de arquivo citados no pedido e na análise do Architect (linha "ARQUIVOS:" primeiro).
 * O agente que implementa começa com esses arquivos já lidos e com a lista explícita no objetivo.
 */
function filesIn(...texts) {
  const out = [];
  const add = p => {
    const s = String(p || '').trim().replace(/^\.\//, '').replace(/[.,;:)]+$/, '');
    if (s && !s.startsWith('/') && !s.split('/').includes('..') && /^[\w@.()[\]-]+(?:\/[\w@.()[\]-]+)+\.[A-Za-z0-9]{1,8}$/.test(s) && !out.includes(s)) out.push(s);
  };
  // Na ordem dos textos (pedido do usuário antes da análise); em cada um, a linha ARQUIVOS antes das menções soltas.
  for (const t of texts) {
    const line = /^\s*\**ARQUIVOS\**\s*:\s*(.+)$/im.exec(String(t || ''));
    if (line) line[1].split(/[,\s]+/).map(x => x.replace(/[`*"']/g, '')).forEach(add);
    for (const m of String(t || '').matchAll(/(?:^|[\s`'"(\[])((?:[\w@.()[\]-]+\/)+[\w@.()[\]-]+\.[A-Za-z0-9]{1,8})(?=$|[\s`'"),:;\]]|\.(?:\s|$))/gm)) add(m[1]);
  }
  return out.slice(0, 8);
}

// ── Planos por intenção ──────────────────────────────────────────────────────
function planFor(intent, message) {
  const sp = specialistFor(message);
  const P = (agent, goal, action) => ({ agent, goal, action });
  switch (intent) {
    // ADR-Q-04: site/sistema novo → o Designer escreve o spec (JSON) e o NEXIA Site Kit gera o código.
    case 'change': return [
      ...(buildKind(message)
        ? [P('coder', 'Criar a branch de trabalho "nexia/..."', 'create_branch'),
          P('designer', 'Escrever textos, fontes, cores e seções e buscar fotos reais (spec do Site Kit)', 'design_spec'),
          P(sp, 'Gerar o código com o NEXIA Site Kit e salvar na branch', 'agent:implement')]
        : [P('architect', 'Analisar o pedido, localizar arquivos e propor a mudança mínima', 'agent:analyze'),
          P('coder', 'Criar a branch de trabalho "nexia/..."', 'create_branch'),
          P(sp, 'Implementar a mudança na branch de trabalho', 'agent:implement')]),
      P('reviewer', 'Revisar o diff contra o pedido', 'agent:review'),
      P('security', 'Revisar o diff quanto a segurança', 'agent:security'),
      P('devops', 'Abrir o PR (rascunho) para a branch padrão', 'create_pr'),
      P('qa', 'Verificar os checks do CI (gates 1–7)', 'checks'),
    ];
    case 'pipeline': return [
      P('devops', 'Gerar o pipeline modelo a partir dos ambientes do Vault', 'render_pipeline'),
      P('devops', 'Criar a branch de trabalho', 'create_branch'),
      P('devops', 'Commitar o pipeline na branch', 'commit_pipeline'),
      P('devops', 'Abrir o PR (rascunho)', 'create_pr'),
      P('qa', 'Verificar os checks do CI (gates 1–7)', 'checks'),
    ];
    case 'deploy_staging': return [
      P('qa', 'Confirmar que o CI da branch de staging está verde (gates 1–7)', 'checks_before_deploy'),
      P('devops', 'Disparar o pipeline para staging', 'deploy_staging'),
      P('devops', 'Acompanhar o deploy e o health check', 'sync_deploy'),
    ];
    case 'deploy_production': return [
      P('qa', 'Confirmar que o CI da branch de produção está verde (gates 1–7)', 'checks_before_deploy'),
      P('devops', 'Pedir aprovação humana e disparar produção para o commit já validado em staging', 'deploy_production'),
      P('devops', 'Acompanhar o deploy de produção e o health check', 'sync_deploy'),
    ];
    default: return [P('architect', 'Responder ao pedido só com leitura do Vault e do GitHub', 'agent:answer')];
  }
}

/**
 * @param {{ vault, gateway, router, now?: () => Date, resolver?, contextBuilder? }} deps
 */
function createOrchestrator(deps) {
  const { vault, gateway, router } = deps;
  const fetchImpl = deps.fetchImpl || ((...a) => fetch(...a));
  /** Confere se uma foto/vídeo externo abre (só o primeiro byte). Erro de rede conta como fora do ar. */
  const reachable = async url => {
    try {
      const res = await fetchImpl(url, { method: 'GET', headers: { Range: 'bytes=0-0', 'User-Agent': 'NEXIA-AI/1.0 (https://github.com/gilcambe/nexia)' }, redirect: 'follow', signal: AbortSignal.timeout(15000) });
      if (res.body && res.body.cancel) res.body.cancel().catch(() => {});
      // 429: o servidor de fotos (ex.: Wikimedia gerando miniatura) pediu calma; a foto existe.
      return res.status < 400 || res.status === 429;
    } catch { return false; }
  };
  const now = deps.now || (() => new Date());
  const resolve = deps.resolver || resolveProject;
  const contextOf = deps.contextBuilder || buildContext;
  const agentCtx = (ctx, agent) => ({ ...ctx, actor: { type: 'agent', id: agent } });

  // Texto livre vindo da IA (resumos, pergunta, feedback) pode citar algo com cara de secret
  // (ex.: um SHA de commit ou "token: ..."). O Vault recusaria a gravação inteira; aqui o
  // trecho suspeito vira "[redigido]" e a execução segue.
  async function save(ctx, exe, patch) {
    const p = { ...patch };
    for (const k of ['result_summary', 'question', 'fix_feedback']) if (typeof p[k] === 'string') p[k] = redactSecrets(p[k]);
    if (Array.isArray(p.plan)) p.plan = p.plan.map(s => (typeof s.summary === 'string' ? { ...s, summary: redactSecrets(s.summary) } : s));
    return vault.Execution.update(ctx, exe.id, p, { expectedVersion: exe.version });
  }
  // Entrada recusada pelo gateway (ex.: INVALID_INPUT) vira resultado "failed", como nos agentes; não derruba a execução.
  const tool = async (ctx, exe, agent, name, input, environment) => {
    try { return await gateway.invoke(agentCtx(ctx, agent), { projectId: exe.project_id, tool: name, input, ...(environment ? { environment } : {}) }); }
    catch (e) {
      if (!(e && /^[A-Z_]+$/.test(e.code || '')) || ['BUDGET_EXCEEDED', 'VERSION_CONFLICT'].includes(e.code)) throw e;
      return { status: 'failed', error: { code: e.code, message: `${e.message}${e.details && e.details.problems ? ` ${JSON.stringify(e.details.problems).slice(0, 300)}` : ''}` } };
    }
  };

  /** Executa os passos a partir do primeiro não concluído. */
  async function advance(ctx, exe, req) {
    const message = exe.request_summary;
    const plan = planFor(exe.intent, message);
    const meter = createMeter({ ...DEFAULT_BUDGET, ...(exe.budget || {}) });
    const project = await vault.Project.get(ctx, exe.project_id);
    const repo = project.primary_repository_id ? await vault.Repository.get(ctx, project.primary_repository_id)
      : (await vault.Repository.list(ctx, { where: { project_id: project.id }, limit: 1 }))[0];
    let context = null;
    const getContext = async () => context || (context = (await contextOf({ vault, ctx, projectId: project.id, message })).text);
    const baseUsage = exe.usage || {};   // uso acumulado antes desta rodada
    let state = { ...exe };
    let steps = exe.plan.map(s => ({ ...s }));
    // O plano gravado pelo site (Worker) pode ser de uma versão anterior à do executor: antes do primeiro
    // passo, os nomes de agente e objetivo seguem o plano que vai rodar de fato.
    if (exe.status === 'planned' && steps.length === plan.length) steps = steps.map((s, k) => ({ ...s, agent: plan[k].agent, goal: plan[k].goal }));
    let stop = null;          // { status, error_code?, result_summary?, question? }
    let checks = null;

    const commit = async patch => {
      state = await save(ctx, state, { plan: steps, usage: usageOf(meter, baseUsage), models: [...new Set([...(state.models || []), ...meter.usage.models])].slice(0, 20), ...patch });
      steps = state.plan.map(s => ({ ...s }));
    };
    const stepDone = (i, o) => { steps[i] = { ...steps[i], status: 'done', attempts: (steps[i].attempts || 0) + 1, ...clean(o) }; };
    const stepWait = (i, o) => { steps[i] = { ...steps[i], status: 'waiting_approval', attempts: (steps[i].attempts || 0) + 1, ...clean(o) }; };
    const stepFail = (i, o) => { steps[i] = { ...steps[i], status: 'failed', attempts: (steps[i].attempts || 0) + 1, ...clean(o) }; };
    const ids = r => (r && r.tool_call ? [r.tool_call.id] : []);
    const addIds = (i, more) => [...new Set([...(steps[i].tool_call_ids || []), ...more])].slice(0, 50);

    // Resultado de uma ferramenta determinística: segue, espera aprovação ou falha.
    const handle = (i, r, okSummary) => {
      if (r.status === 'succeeded') { stepDone(i, { tool_call_ids: addIds(i, ids(r)), summary: okSummary(r.result) }); return true; }
      if (r.status === 'pending_approval') { stepWait(i, { tool_call_ids: addIds(i, ids(r)), summary: `Aguardando aprovação: ${r.reason}` }); stop = { status: 'waiting_approval', result_summary: `Aguardando aprovação humana em /aprovacoes (${steps[i].goal}).` }; return false; }
      const code = r.status === 'denied' ? 'POLICY_DENIED' : (r.error && r.error.code) || 'TOOL_ERROR';
      stepFail(i, { tool_call_ids: addIds(i, ids(r)), error_code: code, summary: (r.error && r.error.message) || r.reason || code });
      stop = { status: 'failed', error_code: code, result_summary: `Falhou em "${steps[i].goal}": ${(r.error && r.error.message) || r.reason || code}` };
      return false;
    };

    const runA = async (i, agentId, goal, extraCtx = '', opts = {}) => {
      steps[i] = { ...steps[i], status: 'running' };
      await commit({ status: 'running' });
      const r = await runAgent({ agentId, goal, context: `${await getContext()}${extraCtx}`, router, gateway, ctx: agentCtx(ctx, agentId), projectId: project.id, meter, ...opts });
      const base = { tool_call_ids: addIds(i, r.tool_call_ids), ...(r.model ? { model: r.model } : {}) };
      if (r.status === 'done') { stepDone(i, { ...base, summary: r.report ? `${r.report.verdict}: ${r.report.findings.map(f => `[${f.severity}] ${f.file ? `${f.file}: ` : ''}${f.message}`).join(' | ') || 'sem problemas'}` : r.text }); return r; }
      if (r.status === 'waiting_approval') { stepWait(i, { ...base, summary: r.text }); stop = { status: 'waiting_approval', result_summary: `Aguardando aprovação humana em /aprovacoes: ${r.pending.tool}.` }; return r; }
      stepFail(i, { ...base, error_code: r.error_code, summary: r.text });
      stop = { status: 'failed', error_code: r.error_code, result_summary: `O agente ${agentId} falhou: ${r.text}` };
      return r;
    };

    // Lê os arquivos web alterados na branch e roda a checagem estática; referências locais que não
    // estão no diff são conferidas na branch (só "não existe" vira erro).
    const webCheck = async kind => {
      const c = await tool(ctx, state, 'qa', 'github.compare', { base: repo.default_branch, head: state.work_branch });
      if (c.status !== 'succeeded') return null;
      const idList = [...ids(c)];
      const files = [];
      for (const f of c.result.files.filter(x => x.status !== 'removed' && !x.sensitive && WEB.test(x.path)).slice(0, 15)) {
        const g = await tool(ctx, state, 'qa', 'github.get_file', { path: f.path, ref: state.work_branch });
        idList.push(...ids(g));
        if (g.status === 'succeeded') files.push({ path: f.path, content: g.result.content });
      }
      if (!files.length) return null;
      const added = new Set(c.result.files.filter(x => x.status === 'added').map(x => x.path));
      const out = checkWebFiles(files, { design: kind, added });
      // Fotos e vídeos externos (hotlink) precisam abrir de verdade.
      for (const u of out.externalMedia.slice(0, 12)) {
        if (!(await reachable(u.url))) out.errors.push({ file: u.file, line: u.line, message: `a mídia ${u.url.slice(0, 120)} não abre (troque por outra de media.search_images)` });
      }
      for (const m of out.missingCandidates.slice(0, 10)) {
        const g = await tool(ctx, state, 'qa', 'github.get_file', { path: m.path, ref: state.work_branch });
        idList.push(...ids(g));
        if (g.status === 'failed' && g.error && /NOT_FOUND/.test(g.error.code || '')) out.errors.push({ file: m.file, line: m.line, message: `"${m.ref}" não existe na branch (crie o arquivo, use SVG/CSS no lugar ou remova a referência)` });
      }
      return { ...out, ids: idList };
    };

    // ── ADR-Q-04: NEXIA Site Kit ──
    const kitKind = plan.some(p => p.action === 'design_spec') ? buildKind(message) : null;
    const specPathOf = () => { const d = steps.find((s, k) => plan[k] && plan[k].action === 'design_spec'); const m = d && /spec: (\S+nexia-spec\.json)/.exec(d.summary || ''); return m ? m[1] : null; };

    /** Foto (ou vídeo) para cada lugar do spec: sem repetir, e só links que abrem de verdade. */
    const resolveMedia = async (spec, { keep = {}, avoid = [] } = {}) => {
      const media = {}, used = new Set(avoid), cache = new Map(), idList = [];
      for (const [slot, m] of Object.entries(keep)) if (m && !used.has(m.url)) { media[slot] = m; used.add(m.url); }
      const slots = kit.mediaQueries(spec).filter(s => !media[s.slot]);
      const keyOf = s => `${s.kind || 'image'}|${s.query}|${s.orientation || ''}`;
      const need = {};
      slots.forEach(s => { need[keyOf(s)] = (need[keyOf(s)] || 0) + 1; });
      let searches = 0;
      const search = async s => {
        const k = keyOf(s);
        if (!cache.has(k)) {
          if (++searches > 30) return [];
          const name = { video: 'media.search_videos', gif: 'media.search_gifs', audio: 'media.search_audio' }[s.kind] || 'media.search_images';
          const r = await tool(ctx, state, 'designer', name,
            { query: s.query, count: Math.min(need[k] + 2, 12), ...(s.orientation && !['gif', 'audio'].includes(s.kind) ? { orientation: s.orientation } : {}) });
          idList.push(...ids(r));
          cache.set(k, r.status === 'succeeded' ? (r.result.images || r.result.videos || r.result.gifs || r.result.audio || []) : []);
        }
        return cache.get(k);
      };
      // Tema do site (ex.: "dentist dental"): foto sem relação com ele (paisagem, farmácia...) não entra.
      const words = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z]+/).filter(w => w.length >= 4);
      const hero = slots.find(s => !s.kind);
      const theme = spec.photo_theme || (hero ? words(hero.query).slice(0, 2).join(' ') : '');
      const roots = words(theme).map(w => w.slice(0, 5));
      const relevant = m => !roots.length || roots.some(r => words(`${m.alt} ${m.credit}`).some(w => w.startsWith(r)));
      // Busca curta acha mais: a frase inteira, depois as 3 e 2 primeiras palavras, depois o tema.
      const variants = s => [...new Set([s.query, s.query.split(/\s+/).slice(0, 3).join(' '), s.query.split(/\s+/).slice(0, 2).join(' '), theme].filter(q => /[a-z]{2}/i.test(q || '')))];
      let checks = 40;
      for (const s of slots) {
        for (const q of variants(s)) {
          let list = await search({ ...s, query: q, orientation: q === s.query ? s.orientation : undefined });
          // Vídeo do Commons nem sempre combina com o negócio: vídeo de FUNDO só do Pexels; senão a foto do hero anima.
          if (s.kind === 'video' && /\.video$/.test(s.slot)) list = list.filter(m => m.provider === 'pexels');
          for (const m of list) {
            // Música não tem "tema" no título; foto, GIF e vídeo precisam ter a ver com o negócio.
            if (used.has(m.url) || (s.kind !== 'audio' && !relevant(m))) continue;
            used.add(m.url);
            if (checks-- > 0 && !(await reachable(m.url))) continue;
            media[s.slot] = m;
            break;
          }
          if (media[s.slot] || (s.kind === 'video' && /\.video$/.test(s.slot))) break;
        }
      }
      // Topo e "sobre" nunca ficam sem foto: usa outra foto boa já buscada ou empresta da galeria/serviços.
      for (const s of slots.filter(x => /\.(hero|about)$/.test(x.slot) && !media[x.slot])) {
        for (const m of [...cache.values()].flat()) {
          if (used.has(m.url) || !relevant(m) || m.mime) continue;
          used.add(m.url);
          if (checks-- > 0 && !(await reachable(m.url))) continue;
          media[s.slot] = m;
          break;
        }
        if (media[s.slot]) continue;
        const donor = Object.keys(media).reverse().find(k => /\.(g|item)\d+$/.test(k));
        if (donor) { media[s.slot] = media[donor]; delete media[donor]; }
      }
      return { media, ids: idList };
    };

    /** O modelo escreve o spec (JSON, uma chamada, sem ferramentas); fotos resolvidas aqui; spec salvo na branch. */
    const designSpec = async i => {
      steps[i] = { ...steps[i], status: 'running' };
      await commit({ status: 'running' });
      // ADR-CLONE-01: "crie um site igual ao https://..." → base visual (cores, fontes, estilo, ordem das seções) do
      // site de referência, lida sem navegador; nunca o conteúdo dele. Sem acesso ao site, segue sem base.
      const refUrl = kitKind === 'site' ? cloner.designRequest(message) : null;
      const ref = refUrl ? await (deps.designFetcher || cloner.fetchDesign)(refUrl, { fetchImpl }).catch(() => null) : null;
      const base = kit.specPrompt({ message, kind: kitKind, project: project.name }) + (ref ? cloner.designPrompt(ref.base) : '');
      let spec = null, errs = [], model;
      // ADR-Q-05: o spec só passa se atingir o padrão mínimo de qualidade (até 3 tentativas do Designer).
      for (let attempt = 0; attempt < 3 && !spec; attempt++) {
        const a = await askModel({ agentId: 'designer', system: kit.SPEC_SYSTEM, router, meter,
          prompt: attempt ? `${base}\n\nSua resposta anterior teve estes problemas: ${errs.join('; ')}. Devolva o JSON completo corrigido.` : base });
        if (a.status !== 'done') {
          stepFail(i, { error_code: a.error_code, summary: a.text });
          stop = { status: 'failed', error_code: a.error_code, result_summary: `O agente designer falhou: ${a.text}` };
          return;
        }
        model = a.model;
        const raw = kit.extractJson(a.text);
        if (!raw) { errs = ['a resposta não era um objeto JSON válido']; continue; }
        const n = kit.normalizeSpec(raw, { kind: kitKind, request: message });
        const based = n.spec && ref ? cloner.applyDesignBase(n.spec, ref.base) : n.spec;
        const q = based ? kit.qualityCheck(based, null) : null;
        if (based && !q.content.length) spec = based; else errs = based ? q.content : n.errors;
      }
      if (!spec) {
        stepFail(i, { error_code: 'SPEC_INVALID', ...(model ? { model } : {}), summary: `Spec inválido: ${errs.join('; ')}`.slice(0, 2000) });
        stop = { status: 'failed', error_code: 'SPEC_INVALID', result_summary: `O Designer não devolveu um spec válido: ${errs.join('; ')}`.slice(0, 4000) };
        return;
      }
      let { media, ids: mediaIds } = await resolveMedia(spec);
      // Faltou foto para o piso de qualidade: busca de novo só pelo tema do site, sem repetir as que já falharam.
      let qm = kit.qualityCheck(spec, media).media;
      if (qm.length) {
        const again = await resolveMedia({ ...spec, sections: spec.sections.map(x => ({ ...x, image_query: '', image_queries: (x.image_queries || []).map(() => spec.photo_theme || spec.name) })) }, { keep: media });
        media = again.media; mediaIds = [...mediaIds, ...again.ids];
        qm = kit.qualityCheck(spec, media).media;
      }
      if (qm.length) {
        stepFail(i, { tool_call_ids: addIds(i, mediaIds), error_code: 'QUALITY_BELOW_MIN', ...(model ? { model } : {}), summary: `Abaixo do padrão mínimo de qualidade: ${qm.join('; ')}`.slice(0, 2000) });
        stop = { status: 'failed', error_code: 'QUALITY_BELOW_MIN', result_summary: `Não entreguei porque ficaria abaixo do padrão mínimo de qualidade do NEXIA: ${qm.join('; ')}. Tente de novo mais tarde (os bancos de fotos grátis podem estar fora) ou configure PEXELS_API_KEY (grátis).`.slice(0, 4000) };
        return;
      }
      const path = `${spec.folder}/nexia-spec.json`;
      // Quem grava é o Frontend (o Designer só lê e busca fotos).
      const r = await tool(ctx, state, 'frontend', 'github.commit_files', { branch: state.work_branch, message: `Spec do ${spec.kind === 'system' ? 'sistema' : 'site'} ${spec.name} (NEXIA Site Kit)`,
        files: [{ path, content: `${JSON.stringify({ spec, media }, null, 2)}\n` }] });
      steps[i] = { ...steps[i], tool_call_ids: addIds(i, mediaIds), ...(model ? { model } : {}) };
      const providers = [...new Set(Object.values(media).map(m => m.provider))].join(', ');
      handle(i, r, () => `${spec.name} (${spec.kind === 'system' ? 'sistema' : 'site'}): fontes ${spec.fonts.heading} + ${spec.fonts.body}; paleta ${spec.palette.primary}/${spec.palette.accent}; `
        + (spec.kind === 'system' ? `cadastros: ${spec.entities.map(e => e.label).join(', ')}` : `seções: ${spec.sections.map(x => x.type).join(', ')}`)
        + `; ${Object.keys(media).length} foto(s)/vídeo(s)${providers ? ` (${providers})` : ''}`
        + (ref ? `; base visual de ${ref.source.host} (só design; textos de exemplo para trocar)` : refUrl ? '; site de referência não abriu, segui sem base visual' : '')
        + `. spec: ${path}`);
    };

    const readSpec = async agent => {
      const path = specPathOf();
      const g = path ? await tool(ctx, state, agent, 'github.get_file', { path, ref: state.work_branch }) : null;
      let data = null;
      try { data = g && g.status === 'succeeded' ? JSON.parse(g.result.content) : null; } catch { data = null; }
      const n = data && data.spec ? kit.normalizeSpec(data.spec, { kind: data.spec.kind }) : null;
      return { path, ids: ids(g), spec: n && n.spec, media: (data && data.media) || {} };
    };
    /** Spec + arquivos do kit num commit só. */
    const kitSave = (agent, path, spec, media, message) => tool(ctx, state, agent, 'github.commit_files', { branch: state.work_branch, message,
      files: [{ path, content: `${JSON.stringify({ spec, media }, null, 2)}\n` }, ...Object.entries(kit.render(spec, media)).map(([p, content]) => ({ path: p, content }))] });

    /** Rodada de correção no caminho do kit: a IA corrige o SPEC (pequeno) e o kit gera tudo de novo; o código nunca é editado à mão. */
    const kitRevise = async (i, feedback) => {
      steps[i] = { ...steps[i], status: 'running' };
      await commit({ status: 'running' });
      const cur = await readSpec('designer');
      steps[i] = { ...steps[i], tool_call_ids: addIds(i, cur.ids) };
      if (!cur.spec) {
        stepFail(i, { error_code: 'SPEC_INVALID', summary: 'Não consegui ler o spec na branch para corrigir.' });
        stop = { status: 'failed', error_code: 'SPEC_INVALID', result_summary: `O spec do Site Kit não foi encontrado na branch ${state.work_branch}.` };
        return;
      }
      const prompt = `${kit.specPrompt({ message, kind: kitKind, project: project.name }).split('\nFormato')[0]}\n\nSpec atual:\n${JSON.stringify(cur.spec)}\n\nA revisão pediu estas correções:\n${feedback.slice(0, 1500)}\n\nDevolva o JSON completo corrigido (mesmo formato).`;
      const a = await askModel({ agentId: 'designer', system: kit.SPEC_SYSTEM, router, meter, prompt });
      if (a.status !== 'done') {
        stepFail(i, { error_code: a.error_code, summary: a.text });
        stop = { status: 'failed', error_code: a.error_code, result_summary: `O agente designer falhou: ${a.text}` };
        return;
      }
      const raw = kit.extractJson(a.text);
      const n = raw ? kit.normalizeSpec({ ...raw, folder: cur.spec.folder }, { kind: kitKind, request: message }) : { errors: ['a resposta não era um objeto JSON válido'] };
      const below = n.spec ? kit.qualityCheck(n.spec, null).content : [];
      if (below.length) n.errors = [`abaixo do padrão mínimo: ${below.join('; ')}`];
      const spec = n.spec && !below.length ? n.spec : cur.spec;   // correção inválida ou pior: mantém o spec que já passou
      // Fotos: as que continuam no mesmo lugar ficam; o resto é buscado de novo.
      const { media, ids: mIds } = await resolveMedia(spec, { keep: spec === cur.spec ? cur.media : Object.fromEntries(kit.mediaQueries(spec).filter(q => cur.media[q.slot]).map(q => [q.slot, cur.media[q.slot]])) });
      steps[i] = { ...steps[i], tool_call_ids: addIds(i, mIds), model: a.model };
      const r = await kitSave(plan[i].agent, cur.path, spec, media, `Corrige ${spec.name} (spec revisado, NEXIA Site Kit)`);
      handle(i, r, x => `Spec revisado${spec !== cur.spec ? '' : ` (correção inválida: ${n.errors.join('; ')}; mantido o anterior)`} e código gerado de novo pelo kit (commit ${String(x.commit || '').slice(0, 7)})`);
    };

    /** Foto que não abre no caminho do kit: troca por outra da busca e gera de novo, sem modelo. */
    const kitRepairMedia = async (i, deadUrls) => {
      const cur = await readSpec('designer');
      if (!cur.spec) return null;
      const keep = Object.fromEntries(Object.entries(cur.media).filter(([, m]) => m && !deadUrls.includes(m.url)));
      const { media, ids: mIds } = await resolveMedia(cur.spec, { keep, avoid: deadUrls });
      const r = await kitSave('frontend', cur.path, cur.spec, media, `Troca fotos que não abriam (${cur.spec.name}, NEXIA Site Kit)`);
      return { ids: [...cur.ids, ...mIds, ...ids(r)], ok: r.status === 'succeeded' };
    };

    /** Gera os arquivos com o kit a partir do spec salvo na branch e commita (determinístico). */
    const kitRender = async i => {
      steps[i] = { ...steps[i], status: 'running' };
      await commit({ status: 'running' });
      const path = specPathOf();
      const g = path ? await tool(ctx, state, plan[i].agent, 'github.get_file', { path, ref: state.work_branch }) : null;
      let data = null;
      try { data = g && g.status === 'succeeded' ? JSON.parse(g.result.content) : null; } catch { data = null; }
      const n = data && data.spec ? kit.normalizeSpec(data.spec, { kind: data.spec.kind }) : null;
      if (!n || !n.spec) {
        stepFail(i, { tool_call_ids: addIds(i, ids(g)), error_code: 'SPEC_INVALID', summary: `Não consegui ler o spec ${path || '(sem caminho)'} na branch.` });
        stop = { status: 'failed', error_code: 'SPEC_INVALID', result_summary: `O spec do Site Kit não foi encontrado na branch ${state.work_branch}.` };
        return;
      }
      steps[i] = { ...steps[i], tool_call_ids: addIds(i, ids(g)) };
      const files = Object.entries(kit.render(n.spec, data.media || {})).map(([p, content]) => ({ path: p, content }));
      const r = await tool(ctx, state, plan[i].agent, 'github.commit_files', { branch: state.work_branch, message: `Gera ${n.spec.name} com o NEXIA Site Kit`, files });
      handle(i, r, x => `NEXIA Site Kit: ${files.map(f => f.path).join(', ')} (commit ${String(x.commit || '').slice(0, 7)})`);
    };

    const readChecks = async (i, ref) => {
      const r = await tool(ctx, state, 'qa', 'github.get_checks', { ref });
      if (r.status !== 'succeeded') { handle(i, r); return null; }
      return { list: r.result.runs, id: r.tool_call.id };
    };

    try {
      for (let i = 0; i < plan.length && !stop; i++) {
        if (steps[i].status === 'done' || steps[i].status === 'skipped') continue;
        const { action } = plan[i];
        const analysis = (steps.find((s, k) => ['agent:analyze', 'design_spec'].includes(plan[k].action)) || {}).summary || '';
        const diffRef = `${repo ? repo.default_branch : 'main'}...${state.work_branch}`;

        if (action === 'agent:analyze' || action === 'agent:answer') {
          await runA(i, plan[i].agent, action === 'agent:answer'
            ? `Pedido do usuário: "${message}"\nResponda com base nas ferramentas de leitura. Cite as evidências (ids, arquivos, SHAs).`
            : plan[i].agent === 'designer'
              ? `Pedido do usuário: "${message}"\nTipo: ${buildKind(message) === 'system' ? 'sistema (interface de uso diário)' : 'site'}. Veja no repositório onde os arquivos vão ficar e devolva o BRIEF visual com fontes, paleta, seções e mídia real (busque fotos${buildKind(message) === 'site' ? ' — pelo menos 6' : ' se fizer sentido'}). Não altere nada.`
              : `Pedido do usuário: "${message}"\nAnalise o repositório do projeto, localize os arquivos envolvidos e descreva a mudança mínima (arquivos e o que muda). Não altere nada. Última linha: "ARQUIVOS: " e os caminhos completos de todos os arquivos a alterar, separados por vírgula.`);
        } else if (action === 'design_spec') {
          await designSpec(i);
        } else if (action === 'create_branch') {
          const hadBranch = !!state.work_branch;   // retomada: a branch pode já ter sido criada
          const branch = state.work_branch || `nexia/${slug(message)}-${state.execution_id.slice(-6).toLowerCase().replace(/[^a-z0-9]/g, '')}`;
          if (!state.work_branch) await commit({ work_branch: branch });
          const r = await tool(ctx, state, plan[i].agent, 'github.create_branch', { branch });
          const exists = r.status === 'failed' && r.error && r.error.code === 'CONFLICT' && ((steps[i].attempts || 0) > 0 || hadBranch);
          if (exists) stepDone(i, { tool_call_ids: addIds(i, ids(r)), summary: `${branch} já existia (retomada)` });
          else handle(i, r, x => `branch ${x.branch} criada de ${x.from}`);
        } else if (action === 'agent:implement') {
          const fix = state.fix_feedback
            ? `\n\nRODADA DE CORREÇÃO ${state.fix_rounds}: a revisão pediu mudanças. Corrija TODOS os pontos abaixo na mesma branch, com um novo commit:\n${state.fix_feedback}`
            : '';
          const headOf = r => (r && r.status === 'succeeded' && r.result.commits.length ? r.result.commits[r.result.commits.length - 1].sha : null);
          let before = null;   // rodada de correção: exige commit novo, não basta o da rodada anterior
          if (fix) before = headOf(await tool(ctx, state, 'qa', 'github.compare', { base: repo.default_branch, head: state.work_branch }));
          if (kitKind && !fix) await kitRender(i);
          else if (kitKind) await kitRevise(i, state.fix_feedback);
          else {
            // ADR-CORTEX-01: lista explícita de arquivos e os primeiros já lidos (economiza passos e cota do modelo grátis).
            const files = filesIn(message, analysis, state.fix_feedback || '');
            const listed = files.length ? `\nArquivos envolvidos (todos precisam ser conferidos; os primeiros já foram lidos abaixo): ${files.join(', ')}` : '';
            await runA(i, plan[i].agent, `Pedido do usuário: "${message}"\nBranch de trabalho: ${state.work_branch} (já existe).\n${kitKind ? 'Spec do Designer (o código foi gerado pelo NEXIA Site Kit: corrija só o que a revisão apontou, com github.edit_files, sem reescrever os arquivos inteiros)' : 'Análise do Architect'}:\n${analysis}${fix}${listed}\n\nLeia os arquivos atuais com github.get_file (ref ${state.work_branch}). Para arquivo existente use github.edit_files; para arquivo novo, github.commit_files. Tudo na branch ${state.work_branch}. Não mexa em arquivos que o pedido não envolve. Cumpra cada item do pedido em todos os arquivos citados antes de terminar.`,
              '', { branch: state.work_branch, preload: files.slice(0, 4), ref: state.work_branch });
          }
          if (!stop) {
            // Confirmação pela ferramenta: a branch tem que estar à frente da padrão.
            const c = await tool(ctx, state, 'qa', 'github.compare', { base: repo.default_branch, head: state.work_branch });
            if (c.status !== 'succeeded' || !c.result.ahead_by || (before && headOf(c) === before)) {
              const why = fix ? `A rodada de correção terminou sem commit novo; a revisão continua pedindo mudanças (branch ${state.work_branch}).` : 'O agente terminou sem commit na branch de trabalho; nada foi alterado.';
              // O que o agente disse (e as gravações recusadas) fica no passo para diagnóstico.
              const said = steps[i].status === 'done' && steps[i].summary ? ` Agente: ${String(steps[i].summary).slice(0, 900)}` : '';
              stepFail(i, { tool_call_ids: addIds(i, ids(c)), error_code: 'NO_CHANGES', summary: `${fix ? 'Sem commit novo na rodada de correção.' : 'Nenhum commit na branch de trabalho; nada foi alterado.'}${said}` });
              stop = { status: 'failed', error_code: 'NO_CHANGES', result_summary: why };
            } else steps[i] = { ...steps[i], tool_call_ids: addIds(i, ids(c)), summary: `${steps[i].summary || ''}\n${c.result.ahead_by} commit(s), ${c.result.files.length} arquivo(s): ${c.result.files.map(f => f.path).slice(0, 10).join(', ')}`.trim().slice(0, 2000) };
          }
        } else if (action === 'agent:review' || action === 'agent:security') {
          // ADR-Q-02: checagem estática dos arquivos web antes da revisão por IA. Erro volta direto ao agente.
          let sc = action === 'agent:review' ? await webCheck(buildKind(message)) : null;
          // Kit: se o único problema são fotos que não abrem, troca as fotos e confere de novo (uma vez), sem modelo.
          const DEAD = /^a mídia (\S+) não abre/;
          if (kitKind && sc && sc.errors.length && sc.errors.every(e => DEAD.test(e.message))) {
            const dead = sc.errors.map(e => DEAD.exec(e.message)[1]).map(u => (sc.externalMedia.find(m => m.url.startsWith(u)) || { url: u }).url);
            const fixed = await kitRepairMedia(i, dead);
            if (fixed && fixed.ok) {
              const again = await webCheck(buildKind(message));
              if (again) sc = { ...again, ids: [...sc.ids, ...fixed.ids, ...again.ids] };
            }
          }
          let r;
          // Código do kit sem edição de agente: é sempre o mesmo código testado (unitários + checagem acima).
          // No caminho do kit o código nunca é editado por modelo: correções mudam o spec e o kit gera de novo.
          const kitPure = !!kitKind;
          if (action === 'agent:security' && kitPure) {
            stepDone(i, { summary: 'approve: código gerado pelo NEXIA Site Kit (HTML/CSS/JS estáticos testados, sem backend nem segredos; todo texto do spec é escapado). O secret scan do CI continua valendo.' });
            r = { status: 'done', report: { verdict: 'approve', findings: [] } };
          } else if (sc && sc.errors.length) {
            const findings = sc.errors.slice(0, 30).map(e => ({ severity: 'high', file: e.file, message: `${e.line ? `linha ${e.line}: ` : ''}${e.message}` }));
            stepDone(i, { tool_call_ids: addIds(i, sc.ids), summary: `changes_requested: checagem automática: ${fmt(sc.errors.slice(0, 30))}`.slice(0, 2000) });
            r = { status: 'done', report: { verdict: 'changes_requested', findings } };
          } else {
            const hint = sc && sc.warnings.length ? `\nA checagem automática deixou estes avisos; confira cada um e peça correção do que for problema real: ${fmt(sc.warnings.slice(0, 20))}` : '';
            r = await runA(i, plan[i].agent, kitPure && action === 'agent:review'
              ? `Pedido do usuário: "${message}"\nO código foi gerado pelo NEXIA Site Kit (testado) e passou na checagem automática de HTML, CSS, JS, fontes, cores, animações e fotos. NÃO chame github.compare (o diff é grande demais). Leia só ${specPathOf()} com github.get_file (ref ${state.work_branch}) e confira se textos, seções, cadastros, contatos e pasta atendem ao pedido, sem erro de português nem conteúdo genérico. Termine com report_findings.${hint}`
              : `Pedido do usuário: "${message}"\nRevise o diff ${diffRef} (github.compare com base ${repo.default_branch} e head ${state.work_branch}) e termine com report_findings.${hint}`);
          }
          if (r.status === 'done') {
            const v = r.report ? r.report.verdict : 'changes_requested';
            if (!r.report) steps[i] = { ...steps[i], summary: `sem veredito estruturado (tratado como changes_requested): ${steps[i].summary || ''}`.slice(0, 2000) };
            await commit(action === 'agent:review' ? { review_verdict: v } : { security_verdict: v });
            const implIdx = plan.findIndex(p => p.action === 'agent:implement');
            if (v !== 'approve' && (state.fix_rounds || 0) < MAX_FIX_ROUNDS && implIdx >= 0) {
              // ADR-Q-01: volta para o agente que implementou, com o que a revisão pediu.
              for (let k = implIdx; k < plan.length; k++) {
                if (['agent:implement', 'agent:review', 'agent:security'].includes(plan[k].action) && k !== i) steps[k] = { ...steps[k], status: 'pending' };
              }
              const feedback = `${action === 'agent:review' ? 'Reviewer' : 'Security'}: ${steps[i].summary || ''}`.slice(0, 4000);
              steps[i] = { ...steps[i], status: 'pending' };
              await commit({ fix_rounds: (state.fix_rounds || 0) + 1, fix_feedback: feedback });
              i = implIdx - 1;
              continue;
            }
            if (v !== 'approve') {
              // Sem PR com revisão reprovada: a branch fica para correção, nada vai para revisão humana.
              stop = { status: 'failed', error_code: action === 'agent:review' ? 'REVIEW_CHANGES_REQUESTED' : 'SECURITY_CHANGES_REQUESTED',
                result_summary: `${action === 'agent:review' ? 'Reviewer' : 'Security'} Agent pediu mudanças; PR não aberto (branch ${state.work_branch}). ${steps[i].summary || ''}`.slice(0, 4000) };
            }
          }
        } else if (action === 'create_pr') {
          const r = await tool(ctx, state, plan[i].agent, 'github.create_pr', { head: state.work_branch,
            title: `NEXIA: ${message}`.slice(0, 120),
            body: `Pedido: ${message}\n\nExecution: ${state.execution_id}\nReviewer: ${state.review_verdict || '—'} · Security: ${state.security_verdict || '—'}\n\nAberto pelo NEXIA AI (rascunho). O merge é de uma pessoa.` });
          if (handle(i, r, x => `PR #${x.number} ${x.html_url}`)) await commit({ pull_request: r.result.number });
        } else if (action === 'checks' || action === 'checks_before_deploy') {
          const ref = action === 'checks' ? state.work_branch : await deployRef(ctx, project.id, state.intent);
          const c = await readChecks(i, ref);
          if (c) {
            checks = c.list;
            const g = evaluateGates({ checks, checkMap: project.qa_checks }).filter(x => x.gate <= 7);
            stepDone(i, { tool_call_ids: addIds(i, [c.id]), summary: g.map(x => `G${x.gate} ${x.status}`).join(', ') });
            if (action === 'checks_before_deploy' && verdict(g) !== 'passed') {
              stop = { status: verdict(g) === 'failed' ? 'failed' : 'running', error_code: verdict(g) === 'failed' ? 'GATES_FAILED' : undefined,
                result_summary: `O CI de ${ref} não está verde (${g.filter(x => x.status !== 'passed' && x.status !== 'not_applicable').map(x => `${x.name}: ${x.status}`).join('; ')}); ${state.intent === 'deploy_production' ? 'produção' : 'staging'} não foi disparado.` };
            }
          }
        } else if (action === 'render_pipeline' || action === 'commit_pipeline') {
          if (action === 'render_pipeline') {
            const r = await tool(ctx, state, 'devops', 'cicd.render_pipeline', {});
            handle(i, r, x => `${x.path}${x.warnings.length ? ` (avisos: ${x.warnings.join(' ')})` : ''}`);
          } else {
            const r0 = await tool(ctx, state, 'devops', 'cicd.render_pipeline', {});
            if (handle(i, r0, () => 'pipeline gerado')) {
              steps[i].status = 'running';
              const r = await tool(ctx, state, 'devops', 'github.commit_files', { branch: state.work_branch, message: 'Adiciona o pipeline NEXIA (CI, staging e produção protegida)', files: [{ path: r0.result.path, content: r0.result.content }] });
              handle(i, r, x => `commit ${x.commit.slice(0, 7)} em ${x.branch}`);
            }
          }
        } else if (action === 'deploy_staging') {
          const r = await tool(ctx, state, 'devops', 'deploy.staging', {});
          if (handle(i, r, x => `${x.workflow} em ${x.ref} → ${x.deployment_id}`)) await commit({ deployment_id: r.result.deployment_id });
        } else if (action === 'deploy_production') {
          // CRITICAL: sempre vai para /aprovacoes; resume() continua depois da decisão humana.
          const r = await tool(ctx, state, 'devops', 'deploy.production', {}, 'production');
          if (handle(i, r, x => `${x.workflow} em ${x.ref} → ${x.deployment_id}`)) await commit({ deployment_id: r.result.deployment_id });
        } else if (action === 'sync_deploy') {
          const r = await tool(ctx, state, 'devops', 'deploy.sync_status', { deployment_id: state.deployment_id });
          handle(i, r, x => `Deployment ${x.deployment_id}: ${x.status}`);
        }
        // Estado final (com finished_at) só em finish(); aqui só os intermediários.
        await commit({ status: stop && !FINAL.includes(stop.status) ? stop.status : 'running', ...(stop && stop.question ? { question: stop.question } : {}) });
      }
    } catch (e) {
      const code = e && e.code === 'BUDGET_EXCEEDED' ? 'BUDGET_EXCEEDED' : (e && /^[A-Z_]+$/.test(e.code || '') ? e.code : 'ORCHESTRATOR_ERROR');
      stop = { status: 'failed', error_code: code, result_summary: code === 'BUDGET_EXCEEDED' ? e.message : 'Erro interno do Orchestrator; nada foi dado como concluído.' };
      if (code === 'ORCHESTRATOR_ERROR') console.error('[orchestrator]', e && e.stack);
    }

    return finish(ctx, state, steps, meter, stop, checks, baseUsage);
  }

  /** Ref que o deploy publica: branch do ambiente (staging ou production) ou a padrão do repositório. */
  async function deployRef(ctx, projectId, intent) {
    const name = intent === 'deploy_production' ? 'production' : 'staging';
    const env = (await vault.Environment.list(ctx, { where: { project_id: projectId }, limit: 20 })).find(e => e.name === name);
    if (env && env.branch) return env.branch;
    const repo = (await vault.Repository.list(ctx, { where: { project_id: projectId }, limit: 1 }))[0];
    return repo ? repo.default_branch : null;
  }

  async function gateEvidence(ctx, exe, checks) {
    let ck = checks;
    const ref = ['change', 'pipeline'].includes(exe.intent) ? exe.work_branch : ['deploy_staging', 'deploy_production'].includes(exe.intent) ? await deployRef(ctx, exe.project_id, exe.intent) : null;
    if (!ck && ref) {
      const r = await tool(ctx, exe, 'qa', 'github.get_checks', { ref });
      ck = r.status === 'succeeded' ? r.result.runs : null;
    }
    let deployment = null;
    if (exe.deployment_id) {
      const s = await tool(ctx, exe, 'devops', 'deploy.sync_status', { deployment_id: exe.deployment_id });
      const rec = await vault.Deployment.get(ctx, exe.deployment_id);
      deployment = { id: rec.id, status: s.status === 'succeeded' ? s.result.status : rec.status, approved_by: rec.approved_by };
    }
    const isChange = exe.intent === 'change';
    const project = await vault.Project.get(ctx, exe.project_id);
    return {
      checkMap: project.qa_checks || [],
      checks: ['change', 'pipeline', 'deploy_staging', 'deploy_production'].includes(exe.intent) ? ck : [],
      review: isChange ? (exe.review_verdict ? { verdict: exe.review_verdict } : null) : { verdict: 'approve' },
      security: exe.security_verdict ? { verdict: exe.security_verdict } : null,
      wantsStaging: ['deploy_staging', 'deploy_production'].includes(exe.intent), deployment,
      wantsProduction: exe.intent === 'deploy_production',
    };
  }

  async function finish(ctx, exe, steps, meter, stop, checks, baseUsage = exe.usage) {
    // ADR-FREE-04: IA grátis sem cota agora (todos os provedores em 429/fora) não é falha: a execução
    // volta para "planned" e a retomada agendada (cron do Worker) continua do mesmo passo depois.
    if (stop && stop.status === 'failed' && AI_WAIT.test(stop.error_code || '')) {
      const k = steps.findIndex(x => x.status === 'failed');
      if (k >= 0 && (steps[k].attempts || 0) < AI_WAITS) {
        steps[k] = { ...steps[k], status: 'pending', error_code: 'WAITING_AI_QUOTA' };
        stop = { status: 'planned', error_code: 'WAITING_AI_QUOTA',
          result_summary: `As IAs grátis estão sem cota agora. Nada foi perdido: continuo sozinho do passo ${k + 1} quando a cota voltar (tentativa ${steps[k].attempts || 1} de ${AI_WAITS}).` };
      }
    }
    const readOnly = ['question', 'status', 'unknown', 'review'].includes(exe.intent);
    let gates = [];
    let status = stop ? stop.status : 'running';
    let summary = stop && stop.result_summary;
    if (!stop) {
      if (readOnly) {
        status = 'succeeded';
        summary = steps.map(s => s.summary).filter(Boolean).join('\n').slice(0, 4000) || 'Concluído.';
      } else {
        gates = evaluateGates(await gateEvidence(ctx, exe, checks));
        const v = verdict(gates);
        status = v === 'passed' ? 'succeeded' : v === 'failed' ? 'failed' : 'running';
        summary = describe(exe, gates, v);
      }
    } else if (!readOnly && stop.status !== 'needs_input') {
      gates = evaluateGates(await gateEvidence(ctx, exe, checks).catch(() => ({ checks: null })));
    }
    const patch = {
      plan: steps, status, gates, usage: usageOf(meter, baseUsage),
      models: [...new Set([...(exe.models || []), ...meter.usage.models])].slice(0, 20),
      result_summary: String(summary || '').slice(0, 4000) || undefined,
      ...(stop && stop.error_code ? { error_code: stop.error_code } : {}),
      ...(stop && stop.question ? { question: stop.question } : {}),
      ...(FINAL.includes(status) ? { finished_at: now().toISOString() } : {}),
    };
    return save(ctx, exe, clean(patch));
  }

  function describe(exe, gates, v) {
    const open = gates.filter(g => g.status === 'pending').map(g => g.name);
    const failed = gates.filter(g => g.status === 'failed').map(g => `${g.name} (${g.evidence})`);
    const where = [exe.work_branch && `branch ${exe.work_branch}`, exe.pull_request && `PR #${exe.pull_request}`, exe.deployment_id && `deployment ${exe.deployment_id}`].filter(Boolean).join(', ');
    if (v === 'passed') return `Concluído com todos os gates verdes${where ? ` (${where})` : ''}.`;
    if (v === 'failed') return `Não concluído: falhou ${failed.join('; ')}${where ? ` (${where})` : ''}.`;
    return `Em andamento${where ? ` (${where})` : ''}: aguardando ${open.join(', ')}.`;
  }

  /**
   * Novo pedido. Pedido ambíguo devolve a pergunta sem criar execução (spec §29 caso B).
   * @param ctx  contexto do usuário (tenant + ator)
   * @param {{ message, projectId?, conversationProjectId?, recentProjectIds?, repository?, budget?, idempotencyKey? }} req
   * @returns {{ status: 'needs_input', question, candidates } | { execution }}
   */
  async function start(ctx, req) {
    const message = String(req.message || '').trim();
    if (!message) return { status: 'needs_input', question: 'O que você quer fazer?', candidates: [] };
    const intent = classifyIntent(message);
    const r = await resolve({ vault, ctx, message, selectedProjectId: req.projectId, conversationProjectId: req.conversationProjectId,
      recentProjectIds: req.recentProjectIds, repository: req.repository });
    if (!r.project_id) {
      return { status: 'needs_input', intent, question: r.question || 'Não identifiquei o projeto. Qual é?', candidates: r.candidates };
    }
    const plan = planFor(intent, message).map((s, i) => ({ step: i + 1, agent: s.agent, goal: s.goal, status: 'pending', tool_call_ids: [] }));
    const { record, replayed } = await vault.Execution.create(ctx, {
      project_id: r.project_id, client_id: r.client_id, execution_id: ctx.executionId, requested_by: ctx.actor,
      request_summary: message.slice(0, 500), intent, status: 'planned', plan, budget: { ...DEFAULT_BUDGET, ...(req.budget || {}) },
      usage: { tool_calls: 0, input_tokens: 0, output_tokens: 0, cost_usd_micros: 0, cost_known: true, duration_ms: 0 },
      started_at: now().toISOString(),
    }, req.idempotencyKey ? { idempotencyKey: req.idempotencyKey } : {});
    return { execution: record, replayed, resolution: { confidence: r.confidence, rationale: r.rationale } };
  }

  /** Executa (ou continua) uma execução até concluir, esperar aprovação/CI ou falhar. */
  async function run(ctx, executionId) {
    const exe = await vault.Execution.get(ctx, executionId);
    if (FINAL.includes(exe.status) || exe.status === 'needs_input') return exe;
    return advance(ctx, exe);
  }

  /**
   * Retoma depois de uma aprovação: o passo que esperava segue se a chamada aprovada
   * terminou bem; falha se foi rejeitada/expirou/falhou; não faz nada se ainda está pendente.
   */
  async function resume(ctx, executionId) {
    const exe = await vault.Execution.get(ctx, executionId);
    if (exe.status !== 'waiting_approval') return run(ctx, executionId);
    const i = exe.plan.findIndex(s => s.status === 'waiting_approval');
    if (i < 0) return run(ctx, executionId);
    const lastId = (exe.plan[i].tool_call_ids || []).slice(-1)[0];
    const call = lastId ? await vault.ToolCall.get(ctx, lastId) : null;
    if (!call || call.status === 'pending_approval') return exe;
    const plan = exe.plan.map(s => ({ ...s }));
    const action = planFor(exe.intent, exe.request_summary)[i].action;
    if (call.status === 'succeeded') {
      // Passo determinístico: a própria chamada aprovada conclui o passo. Passo de agente: o
      // agente roda de novo para terminar o trabalho (a ação aprovada já foi feita).
      plan[i] = { ...plan[i], status: action.startsWith('agent:') ? 'pending' : 'done', summary: `${call.tool} aprovado e executado (${call.output_summary || 'ok'})`.slice(0, 2000) };
      const patch = { plan, status: 'running' };
      if (call.tool === 'github.create_pr' && /PR #(\d+)/.test(call.output_summary || '')) patch.pull_request = Number(RegExp.$1);
      if (['deploy.staging', 'deploy.production'].includes(call.tool) && /→ (\S+)$/.test(call.output_summary || '')) patch.deployment_id = RegExp.$1;
      return advance(ctx, await save(ctx, exe, patch));
    }
    plan[i] = { ...plan[i], status: 'failed', error_code: call.error_code || call.status.toUpperCase() };
    return save(ctx, exe, { plan, status: 'failed', error_code: call.error_code || 'NOT_APPROVED', finished_at: now().toISOString(),
      result_summary: `A ação ${call.tool} não foi executada (${call.status}); a execução parou sem alterar mais nada.` });
  }

  /** Reavalia os gates (CI terminou? staging terminou?) de uma execução em andamento. */
  async function refresh(ctx, executionId) {
    const exe = await vault.Execution.get(ctx, executionId);
    if (exe.status !== 'running' || exe.plan.some(s => s.status !== 'done' && s.status !== 'skipped')) return exe;
    return finish(ctx, exe, exe.plan, createMeter({ ...DEFAULT_BUDGET }), null, null);
  }

  /**
   * Fase 11 (ADR-F11-03): retoma execuções paradas — o processo pode ter reiniciado no meio de
   * um run em segundo plano. Só mexe nas que estão sem atualização há staleMs:
   * planned/running com passo pendente → run (continua do primeiro passo não concluído);
   * running com todos os passos concluídos → refresh (gates); waiting_approval → resume.
   */
  // ADR-F12-03: `statuses` e `ctxFor` permitem a retomada agendada (sem pessoa) continuar só
  // execuções em andamento, cada uma em nome de quem pediu.
  async function sweep(ctx, { staleMs = 10 * 60 * 1000, max = 20, statuses = ['planned', 'running', 'waiting_approval'], ctxFor = () => ctx } = {}) {
    const cutoff = new Date(now().getTime() - staleMs).toISOString();
    const out = [];
    for (const status of statuses) {
      const list = (await vault.Execution.list(ctx, { where: { status }, limit: 200 })).filter(x => (x.updated_at || x.started_at) <= cutoff);
      for (const x of list) {
        if (out.length >= max) return out;
        const action = status === 'waiting_approval' ? 'resume' : x.plan.every(s => s.status === 'done' || s.status === 'skipped') ? 'refresh' : 'run';
        try {
          const r = await { resume, refresh, run }[action](ctxFor(x), x.id);
          out.push({ id: x.id, action, from: status, to: r.status });
        } catch (e) {
          out.push({ id: x.id, action, from: status, error: e && /^[A-Z_]+$/.test(e.code || '') ? e.code : 'ERROR' });
        }
      }
    }
    return out;
  }

  return { start, run, resume, refresh, sweep, classifyIntent, planFor };
}

function usageOf(meter, prev = {}) {
  const u = meter.usage;
  return {
    tool_calls: (prev.tool_calls || 0) + u.tool_calls,
    input_tokens: (prev.input_tokens || 0) + u.input_tokens,
    output_tokens: (prev.output_tokens || 0) + u.output_tokens,
    cost_usd_micros: (prev.cost_usd_micros || 0) + Math.round(u.cost_usd * 1e6),
    cost_known: (prev.cost_known !== false) && u.cost_known,
    duration_ms: (prev.duration_ms || 0) + meter.elapsed(),
  };
}
function clean(o) { return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')); }

module.exports = { buildKind, createOrchestrator, classifyIntent, filesIn, planFor, specialistFor, DEFAULT_BUDGET };
