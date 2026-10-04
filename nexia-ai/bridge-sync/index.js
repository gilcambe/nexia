'use strict';
// Log do NEXIA Bridge no Vault (ADR-F12-04).
//
// Credencial do Bridge: token "nxb_<64 hex>" criado por master/admin do tenant na tela
// /auditoria. O servidor guarda só o SHA-256 (coleção interna bridge_tokens, fechada a
// clientes pelas regras do Firestore); o token aparece uma única vez, na criação.
//
// Cada linha do log local vira um ToolCall "bridge.<ferramenta>" no projeto informado,
// em nome do agente (cliente MCP) que pediu. Idempotente pelo id da linha.
const crypto = require('crypto');
const { createExecutionContext } = require('../vault');

const COLLECTION = 'bridge_tokens';
const TOKEN_RE = /^nxb_[0-9a-f]{64}$/;
const EVENT_ID_RE = /^[0-9a-f]{32}$/;
const TOOL_RE = /^[a-z][a-z0-9_]{0,60}$/;
const ERROR_RE = /^[A-Z0-9_]{1,64}$/;
const MAX_EVENTS = 100;
const MAX_TOKENS = 20;

const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const LOW = new Set(['bridge_projects', 'workspace_list', 'workspace_read', 'git_status', 'git_diff']);
const HIGH = new Set(['workspace_delete']);
const DENIED = new Set(['BLOCKED_BY_MODE', 'COMMAND_DENIED', 'SENSITIVE_FILE', 'OUTSIDE_WORKSPACE', 'SYMLINK_ESCAPE', 'SECRET_IN_CONTENT', 'NOT_APPROVED']);

function riskOf(e) {
  if (e.tool === 'terminal_run') return e.class === 'read' ? 'LOW' : e.class === 'test' ? 'MEDIUM' : 'HIGH';
  if (LOW.has(e.tool)) return 'LOW';
  if (HIGH.has(e.tool)) return 'HIGH';
  return 'MEDIUM';
}

/** Token do cabeçalho Authorization, se tiver o formato do Bridge. */
function bearerOf(event) {
  const h = (event && event.headers) || {};
  const m = /^Bearer\s+(\S+)$/.exec(String(h.authorization || h.Authorization || ''));
  return m && TOKEN_RE.test(m[1]) ? m[1] : null;
}

function createBridgeTokens(db) {
  if (!db) { const e = new Error('Firestore indisponível.'); e.status = 503; throw e; }
  const col = db.collection(COLLECTION);
  return {
    async create(tenantId, { label, actor }) {
      const existing = await col.where('tenant_id', '==', tenantId).get();
      if (existing.docs.filter(d => !d.data().revoked_at).length >= MAX_TOKENS) {
        const e = new Error(`No máximo ${MAX_TOKENS} tokens ativos por tenant.`); e.status = 409; throw e;
      }
      const token = `nxb_${crypto.randomBytes(32).toString('hex')}`;
      const hash = sha256(token);
      const record = { id: hash.slice(0, 16), tenant_id: tenantId, label: String(label || 'Bridge').slice(0, 80),
        created_by: actor, created_at: new Date().toISOString(), last_used_at: null, revoked_at: null };
      await col.doc(hash).create(record);
      return { record, token };
    },
    async list(tenantId) {
      const snap = await col.where('tenant_id', '==', tenantId).get();
      return snap.docs.map(d => d.data()).sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async revoke(tenantId, id) {
      const snap = await col.where('tenant_id', '==', tenantId).where('id', '==', String(id)).limit(1).get();
      if (snap.empty) return null;
      const at = new Date().toISOString();
      await snap.docs[0].ref.update({ revoked_at: at });
      return { ...snap.docs[0].data(), revoked_at: at };
    },
    /** { tenantId, tokenId } ou null. */
    async authenticate(event) {
      const token = bearerOf(event);
      if (!token) return null;
      const ref = col.doc(sha256(token));
      const doc = await ref.get();
      if (!doc.exists || doc.data().revoked_at) return null;
      ref.update({ last_used_at: new Date().toISOString() }).catch(() => {});
      return { tenantId: doc.data().tenant_id, tokenId: doc.data().id };
    },
  };
}

function toToolCall(e, now) {
  const at = new Date(e.ts);
  if (Number.isNaN(at.getTime()) || at > new Date(now.getTime() + 5 * 60e3) || at < new Date(now.getTime() - 30 * 86400e3)) return { error: 'INVALID_TS' };
  if (!TOOL_RE.test(String(e.tool || ''))) return { error: 'INVALID_TOOL' };
  if (typeof e.project_id !== 'string' || !e.project_id) return { error: 'NO_PROJECT' };
  if (e.status === 'confirmation_required' || e.status === 'confirmation_pending') return { skip: true }; // a linha final chega depois da aprovação local
  const errorCode = e.status === 'error' ? (ERROR_RE.test(String(e.error_code || '')) ? e.error_code : 'INTERNAL') : null;
  const denied = errorCode && DENIED.has(errorCode);
  const failed = errorCode || (e.exit_code !== undefined && e.exit_code !== 0);
  const ts = at.toISOString();
  const input = e.tool === 'terminal_run' ? `${String(e.command || '').slice(0, 300)} (em ${String(e.cwd || '.').slice(0, 100)})` : String(e.path || '').slice(0, 300);
  const agent = String(e.agent || 'mcp').replace(/[^A-Za-z0-9_.:@-]/g, '-').slice(0, 100) || 'mcp';
  return {
    actor: { type: 'agent', id: `bridge:${agent}` },
    data: {
      project_id: e.project_id, tool: `bridge.${e.tool}`, risk: riskOf(e),
      decision: denied ? 'forbidden' : 'auto', decision_reason: denied ? 'Bloqueado pelo NEXIA Bridge local.' : 'Executado pelo NEXIA Bridge local (modo do projeto).',
      status: denied ? 'denied' : failed ? 'failed' : 'succeeded',
      requested_by: { type: 'agent', id: `bridge:${agent}` }, requested_at: ts,
      decided_by: { type: 'system', id: 'nexia-bridge' }, decided_at: ts,
      ...(input ? { input_summary: input } : {}), input_sha256: sha256(input),
      ...(e.exit_code !== undefined ? { output_summary: `exit ${Number(e.exit_code)}${e.class ? ` (${String(e.class).slice(0, 20)})` : ''}` } : {}),
      ...(errorCode ? { error_code: errorCode } : {}),
      ...(Number.isInteger(e.duration_ms) && e.duration_ms >= 0 ? { duration_ms: Math.min(e.duration_ms, 86400000) } : {}),
    },
  };
}

/** Grava os eventos de um lote. Nunca lança por evento: devolve o que entrou e o que não. */
async function ingestEvents({ vault, tenantId, events, now = new Date() }) {
  const out = { accepted: 0, replayed: 0, skipped: 0, rejected: [] };
  for (const [index, e] of events.entries()) {
    if (!e || typeof e !== 'object' || !EVENT_ID_RE.test(String(e.id || ''))) { out.rejected.push({ index, code: 'INVALID_ID' }); continue; }
    const m = toToolCall(e, now);
    if (m.skip) { out.skipped++; continue; }
    if (m.error) { out.rejected.push({ index, code: m.error }); continue; }
    const ctx = createExecutionContext({ tenantId, actor: m.actor });
    const save = data => vault.ToolCall.create(ctx, data, { idempotencyKey: `bridge:${e.id}` });
    try {
      let r;
      try { r = await save(m.data); }
      catch (err) {
        // Resumo com cara de segredo: grava sem o resumo (o hash continua)
        if (err && err.code === 'SECRET_DETECTED' && m.data.input_summary) { const { input_summary, ...rest } = m.data; r = await save(rest); }
        else throw err;
      }
      if (r.replayed) out.replayed++; else out.accepted++;
    } catch (err) {
      out.rejected.push({ index, code: err && /^[A-Z_]+$/.test(err.code || '') ? err.code : 'ERROR' });
    }
  }
  return out;
}

module.exports = { createBridgeTokens, ingestEvents, toToolCall, bearerOf, TOKEN_RE, MAX_EVENTS };
