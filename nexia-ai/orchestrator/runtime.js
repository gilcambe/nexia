'use strict';
// Agent Runtime (spec §7, §27). Roda um agente: o modelo pede ferramentas, o runtime
// confere se o agente pode pedi-las, executa pelo Tool Gateway (que aplica política,
// registra no Vault e põe na fila de aprovação) e devolve o resultado ao modelo, até o
// agente responder sem pedir ferramenta, ficar esperando aprovação ou estourar o orçamento.
//
// Erros (spec §27): falha de ferramenta vira resultado estruturado para o modelo; erro
// transitório (UPSTREAM) é repetido uma vez antes; erro de modelo repete uma vez e depois
// tenta o próximo modelo candidato. Nada é dado como feito sem confirmação da ferramenta.
const { allowed, systemPrompt, AGENTS } = require('./agents');
const { candidates } = require('./models');

const RETRYABLE_TOOL = new Set(['UPSTREAM']);
const RETRYABLE_MODEL = new Set(['UPSTREAM', 'ABORTED']);
// Resultado de ferramenta que volta ao modelo. Grande o bastante para um arquivo de código inteiro
// (cortar arquivo levava o agente a reescrever o que não leu); o orçamento de tokens segue valendo.
const RESULT_MAX = 60000;
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
 * @returns {Promise<{ status: 'done'|'waiting_approval'|'failed', text?, report?, tool_call_ids, model?, error_code?, pending? }>}
 */
async function runAgent(o) {
  const agent = AGENTS[o.agentId];
  const models = candidates(o.router, agent.model);
  const toolCallIds = [];
  if (!models.length) return { status: 'failed', error_code: 'NO_MODEL', text: 'Nenhum modelo com tool_call configurado (ex.: ANTHROPIC_API_KEY).', tool_call_ids: toolCallIds };

  const catalog = o.gateway.describe().filter(t => allowed(o.agentId, t.name));
  const tools = catalog.map(t => ({ name: toModelName(t.name), description: `[${t.risk}] ${t.description}`, input_schema: t.input_schema }));
  if (REPORTING_AGENTS.has(o.agentId)) tools.push(REPORT_TOOL);
  const system = systemPrompt(o.agentId, o.context);
  const messages = [{ role: 'user', content: o.goal }];
  let mi = 0;
  const failures = new Map();

  for (let turn = 0; turn < (agent.max_steps || 8); turn++) {
    o.meter.check();
    let out;
    for (let attempt = 0; ; attempt++) {
      const desc = models[mi];
      try {
        out = await o.router.toolCall(desc, { system, messages, tools, maxTokens: 8192 });
        o.meter.usage.models.add(`${desc.provider}/${desc.model}`);
        break;
      } catch (e) {
        const code = e && e.code;
        if (RETRYABLE_MODEL.has(code) && attempt === 0) continue;               // mesmo modelo, uma vez
        if (mi + 1 < models.length) { mi++; attempt = -1; continue; }           // próximo candidato
        return { status: 'failed', error_code: code && /^[A-Z_]+$/.test(code) ? `MODEL_${code}` : 'MODEL_ERROR', text: 'O modelo não respondeu.', tool_call_ids: toolCallIds };
      }
    }
    o.meter.usage.steps++;
    const u = out.usage || {};
    o.meter.usage.input_tokens += u.input_tokens || 0;
    o.meter.usage.output_tokens += u.output_tokens || 0;
    const cost = o.router.costEstimate ? o.router.costEstimate(models[mi], u) : { known: false };
    if (cost && cost.known) o.meter.usage.cost_usd += cost.usd; else o.meter.usage.cost_known = false;
    const model = `${models[mi].provider}/${models[mi].model}`;

    const calls = out.tool_calls || [];
    if (!calls.length) return { status: 'done', text: String(out.text || '').slice(0, 2000), tool_call_ids: toolCallIds, model };

    const results = [];
    for (const call of calls) {
      if (call.name === REPORT_TOOL.name && REPORTING_AGENTS.has(o.agentId)) {
        const r = call.input || {};
        if (!['approve', 'changes_requested'].includes(r.verdict) || !Array.isArray(r.findings)) { results.push({ tool: call.name, error: 'INVALID_INPUT' }); continue; }
        return { status: 'done', report: { verdict: r.verdict, findings: r.findings.slice(0, 50) }, text: String(out.text || '').slice(0, 2000), tool_call_ids: toolCallIds, model };
      }
      const name = fromModelName(call.name);
      if (!allowed(o.agentId, name)) { results.push({ tool: name, error: 'TOOL_NOT_ALLOWED', message: `O agente ${agent.title} não usa ${name}.` }); continue; }
      o.meter.check();
      let r;
      for (let attempt = 0; attempt < 2; attempt++) {
        o.meter.usage.tool_calls++;
        try {
          r = await o.gateway.invoke(o.ctx, { projectId: o.projectId, tool: name, input: call.input || {} });
        } catch (e) {
          r = { status: 'failed', error: { code: e.code || 'TOOL_ERROR', message: e.message } };
        }
        if (r.tool_call) toolCallIds.push(r.tool_call.id);
        if (r.status === 'failed' && RETRYABLE_TOOL.has(r.error && r.error.code) && attempt === 0) continue;
        break;
      }
      if (r.status === 'pending_approval') {
        return { status: 'waiting_approval', pending: { tool: name, tool_call_id: r.tool_call.id, reason: r.reason }, tool_call_ids: toolCallIds, model,
          text: `Aguardando aprovação humana para ${name} (${r.reason}).` };
      }
      if (r.status === 'succeeded') results.push({ tool: name, ok: true, result: r.result });
      else {
        const code = (r.error && r.error.code) || (r.status === 'denied' ? 'POLICY_DENIED' : 'TOOL_ERROR');
        results.push({ tool: name, ok: false, error: code, message: r.error ? r.error.message : r.reason });
        const n = (failures.get(code) || 0) + 1;
        failures.set(code, n);
        if (n >= 3) return { status: 'failed', error_code: code, text: `A ferramenta ${name} falhou 3 vezes (${code}).`, tool_call_ids: toolCallIds, model };
      }
    }
    messages.push({ role: 'assistant', content: `${out.text ? `${out.text}\n` : ''}[ferramentas pedidas: ${calls.map(c => fromModelName(c.name)).join(', ')}]` });
    const body = JSON.stringify(results);
    messages.push({ role: 'user', content: `RESULTADO DAS FERRAMENTAS (JSON):\n${body.length > RESULT_MAX ? `${body.slice(0, RESULT_MAX)}…[cortado]` : body}` });
  }
  return { status: 'failed', error_code: 'MAX_STEPS', text: `O agente ${agent.title} não terminou dentro do limite de passos.`, tool_call_ids: toolCallIds };
}

module.exports = { runAgent, createMeter, BudgetError, toModelName, fromModelName, REPORT_TOOL };
