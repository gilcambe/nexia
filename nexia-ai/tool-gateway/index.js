'use strict';
// Tool Gateway (spec §15, §16, §26, §27). Toda ferramenta que um agente ou o chat usar
// passa por aqui:
//   1. a ferramenta existe no registro e declara seu nível de risco;
//   2. a entrada é validada contra o input_schema (sem campos extras);
//   3. o Policy Engine decide: auto, confirm ou forbidden;
//   4. a chamada é registrada no Vault (ToolCall) com resumo e hash da entrada;
//   5. auto executa na hora; confirm entra na fila de aprovação; forbidden é negada.
// A entrada completa de uma chamada pendente fica em nexia_tool_queue (só servidor, sem
// regra de leitura para clientes) até ser aprovada, rejeitada ou expirar.
const crypto = require('crypto');
const { decide } = require('../policy-engine');
const { validate } = require('../model-router');
const { VaultError, CODES: VAULT_CODES } = require('../vault');
const { GatewayError, CODES } = require('./errors');

const QUEUE_COLLECTION = 'nexia_tool_queue';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TOOLS = [...require('./tools/vault'), ...require('./tools/github'), ...require('./tools/integrations'), ...require('./tools/deploy'), ...require('./tools/media')];

/** Remove sequências hex longas (hashes, SHAs) dos resumos gravados no Vault. */
const safeText = (s, max) => String(s == null ? '' : s).replace(/\b([0-9a-f]{7})[0-9a-f]{9,}\b/gi, '$1…').slice(0, max);
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

function checkInput(tool, input) {
  if (input === undefined || input === null) input = {};
  // Modelos grátis costumam mandar null ou "" em campos opcionais (ex.: ref): isso equivale a "não informado".
  if (typeof input === 'object' && !Array.isArray(input)) {
    const required = new Set(tool.input_schema.required || []);
    const props = tool.input_schema.properties || {};
    input = Object.fromEntries(Object.entries(input).filter(([k, v]) => required.has(k) || !(k in props) || !(v === null || v === '')));
  }
  const problems = validate(tool.input_schema, input);
  if (!problems.length && input && typeof input === 'object' && !Array.isArray(input)) {
    const allowed = Object.keys(tool.input_schema.properties || {});
    for (const k of Object.keys(input)) if (!allowed.includes(k)) problems.push(`$.${k}: campo não permitido`);
  }
  if (problems.length) throw new GatewayError(CODES.INVALID_INPUT, `Entrada inválida para ${tool.name}.`, { problems: problems.slice(0, 10) });
  return input;
}

/**
 * @param {{ db, vault, tools?, env?, fetchImpl?, github?: (repo) => adapter, now?: () => Date, approvalTtlMs?: number }} o
 */
function createGateway(o) {
  const { db, vault } = o;
  const env = o.env || process.env;
  const fetchImpl = o.fetchImpl || ((...a) => fetch(...a));
  const now = o.now || (() => new Date());
  const ttl = o.approvalTtlMs || DEFAULT_TTL_MS;
  const registry = new Map();
  for (const t of o.tools || DEFAULT_TOOLS) {
    if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(t.name) || !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(t.risk) || typeof t.run !== 'function') {
      throw new Error(`Ferramenta inválida no registro: ${t && t.name}`);
    }
    registry.set(t.name, t);
  }
  const queue = id => db.collection(QUEUE_COLLECTION).doc(id);

  async function policyFor(ctx, projectId) {
    const list = await vault.ToolPolicy.list(ctx, { where: { project_id: projectId }, limit: 1 });
    return list[0] || null;
  }

  async function execute(ctx, call, tool, project, input) {
    const t0 = Date.now();
    try {
      const result = await tool.run({ vault, ctx, project, env, fetchImpl, github: o.github }, input);
      const out = tool.summarizeOutput ? tool.summarizeOutput(result, input) : 'ok';
      const record = await vault.ToolCall.update(ctx, call.id, { status: 'succeeded', output_summary: safeText(out, 2000) || 'ok', duration_ms: Date.now() - t0 }, { expectedVersion: call.version });
      return { tool_call: record, status: 'succeeded', result };
    } catch (e) {
      const code = (e && e.code && /^[A-Z0-9_]+$/.test(e.code) ? e.code : 'TOOL_ERROR').slice(0, 64);
      const record = await vault.ToolCall.update(ctx, call.id, { status: 'failed', error_code: code, duration_ms: Date.now() - t0 }, { expectedVersion: call.version });
      return { tool_call: record, status: 'failed', error: { code, message: e instanceof GatewayError || e instanceof VaultError ? e.message : 'Falha ao executar a ferramenta.' } };
    }
  }

  /**
   * Pede a execução de uma ferramenta.
   * @param ctx  contexto de execução (tenant + ator que pede)
   * @param {{ projectId: string, environment?: string, tool: string, input?: object, idempotencyKey?: string }} req
   */
  async function invoke(ctx, req) {
    const tool = registry.get(req.tool);
    if (!tool) throw new GatewayError(CODES.UNKNOWN_TOOL, `Ferramenta desconhecida: ${req.tool}`);
    const input = checkInput(tool, req.input);
    const project = await vault.Project.get(ctx, req.projectId);
    const policy = await policyFor(ctx, project.id);
    const d = decide({ tool, project, environment: req.environment, policy });
    const at = now().toISOString();
    const status = d.decision === 'auto' ? 'running' : d.decision === 'confirm' ? 'pending_approval' : 'denied';
    const data = {
      project_id: project.id, tool: tool.name, risk: tool.risk, decision: d.decision, decision_reason: safeText(d.reason, 300),
      status, requested_by: ctx.actor, requested_at: at, input_sha256: sha256(canonical(input)),
      input_summary: safeText(tool.summarizeInput ? tool.summarizeInput(input) : tool.name, 500) || tool.name,
      execution_id: ctx.executionId,
      ...(req.environment ? { environment: req.environment } : {}),
      ...(d.decision !== 'confirm' ? { decided_by: { type: 'system', id: 'policy-engine' }, decided_at: at } : {}),
    };
    const { record, replayed } = await vault.ToolCall.create(ctx, data, req.idempotencyKey ? { idempotencyKey: req.idempotencyKey } : {});
    if (replayed) return { tool_call: record, status: record.status, replayed: true };
    if (d.decision === 'forbidden') return { tool_call: record, status: 'denied', reason: d.reason };
    if (d.decision === 'confirm') {
      await queue(record.id).set({ tenant_id: ctx.tenantId, project_id: project.id, tool: tool.name, input, environment: req.environment || null, created_at: at });
      return { tool_call: record, status: 'pending_approval', reason: d.reason };
    }
    return execute(ctx, record, tool, project, input);
  }

  async function loadPending(ctx, id, expectedVersion) {
    const call = await vault.ToolCall.get(ctx, id);
    if (call.status !== 'pending_approval') throw new GatewayError(CODES.NOT_PENDING, 'Esta chamada não está aguardando aprovação.', { status: call.status });
    if (expectedVersion !== undefined && expectedVersion !== call.version) throw new VaultError(VAULT_CODES.VERSION_CONFLICT, 'ToolCall: versão divergente.', { current: call.version });
    return call;
  }

  /** Aprova e executa. Só uma pessoa (ator "user") aprova; versão evita execução dupla. */
  async function approve(ctx, id, { expectedVersion } = {}) {
    if (!ctx.actor || ctx.actor.type !== 'user') throw new GatewayError(CODES.FORBIDDEN, 'Só uma pessoa pode aprovar chamadas de ferramenta.');
    const call = await loadPending(ctx, id, expectedVersion);
    const at = now();
    const decided = { decided_by: ctx.actor, decided_at: at.toISOString() };
    if (at.getTime() - Date.parse(call.requested_at) > ttl) {
      const record = await vault.ToolCall.update(ctx, id, { status: 'expired', ...decided, error_code: 'EXPIRED' }, { expectedVersion: call.version });
      await queue(id).delete();
      throw new GatewayError(CODES.EXPIRED, 'A aprovação expirou; peça a ferramenta de novo.', { tool_call: record });
    }
    const q = await queue(id).get();
    const tool = registry.get(call.tool);
    const project = await vault.Project.get(ctx, call.project_id);
    const policy = await policyFor(ctx, project.id);
    const d = tool ? decide({ tool, project, environment: call.environment, policy }) : { decision: 'forbidden' };
    if (!q.exists || q.data().tenant_id !== ctx.tenantId || d.decision === 'forbidden') {
      const record = await vault.ToolCall.update(ctx, id, { status: 'rejected', ...decided, error_code: !q.exists ? 'QUEUE_MISSING' : 'POLICY_FORBIDDEN' }, { expectedVersion: call.version });
      if (q.exists) await queue(id).delete();
      return { tool_call: record, status: 'rejected', reason: d.decision === 'forbidden' ? 'A política atual proíbe esta ferramenta.' : 'Entrada da chamada não encontrada.' };
    }
    const running = await vault.ToolCall.update(ctx, id, { status: 'running', ...decided }, { expectedVersion: call.version });
    await queue(id).delete();
    return execute(ctx, running, tool, project, q.data().input);
  }

  async function reject(ctx, id, { expectedVersion } = {}) {
    if (!ctx.actor || ctx.actor.type !== 'user') throw new GatewayError(CODES.FORBIDDEN, 'Só uma pessoa pode rejeitar chamadas de ferramenta.');
    const call = await loadPending(ctx, id, expectedVersion);
    const record = await vault.ToolCall.update(ctx, id, { status: 'rejected', decided_by: ctx.actor, decided_at: now().toISOString(), error_code: 'REJECTED' }, { expectedVersion: call.version });
    await queue(id).delete();
    return { tool_call: record, status: 'rejected' };
  }

  /** Fila de aprovações pendentes do tenant (opcionalmente de um projeto), mais antigas primeiro. */
  async function pending(ctx, { projectId } = {}) {
    const items = await vault.ToolCall.list(ctx, { where: { status: 'pending_approval' }, limit: 200 });
    return items.filter(c => !projectId || c.project_id === projectId).sort((a, b) => a.requested_at.localeCompare(b.requested_at));
  }

  async function calls(ctx, { projectId, limit = 50 }) {
    return vault.ToolCall.list(ctx, { where: { project_id: projectId }, limit });
  }

  const describe = () => [...registry.values()].map(t => ({ name: t.name, risk: t.risk, min_autonomy: t.min_autonomy, description: t.description, input_schema: t.input_schema }));

  return { invoke, approve, reject, pending, calls, describe, QUEUE_COLLECTION };
}

module.exports = { createGateway, DEFAULT_TOOLS, GatewayError, CODES, QUEUE_COLLECTION, safeText };
