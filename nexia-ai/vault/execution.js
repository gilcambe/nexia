'use strict';
// Execution ID (spec §16): toda execução gera um id que é gravado no documento
// (last_execution_id) e em cada registro de auditoria da mesma execução.
const crypto = require('crypto');
const { VaultError, CODES } = require('./errors');

const EXECUTION_ID_RE = /^exec_[0-9a-f]{32}$/;
const TENANT_ID_RE = /^[a-z0-9][a-z0-9_-]{0,62}$/;
const ACTOR_TYPES = ['user', 'agent', 'system'];
const ACTOR_ID_RE = /^[A-Za-z0-9_.:@-]{1,128}$/;

function newExecutionId() {
  return 'exec_' + crypto.randomUUID().replace(/-/g, '');
}

/**
 * Cria o contexto de uma execução. Todas as escritas feitas com o mesmo contexto
 * compartilham o mesmo executionId.
 * @param {{ tenantId: string, actor: { type: 'user'|'agent'|'system', id: string }, executionId?: string }} opts
 */
function createExecutionContext({ tenantId, actor, executionId } = {}) {
  if (typeof tenantId !== 'string' || !TENANT_ID_RE.test(tenantId)) {
    throw new VaultError(CODES.CONTEXT, 'tenantId inválido no contexto de execução.', { issues: [{ path: 'tenantId', rule: 'pattern' }] });
  }
  if (!actor || !ACTOR_TYPES.includes(actor.type) || typeof actor.id !== 'string' || !ACTOR_ID_RE.test(actor.id)) {
    throw new VaultError(CODES.CONTEXT, 'actor inválido no contexto de execução.', { issues: [{ path: 'actor', rule: 'shape' }] });
  }
  if (executionId !== undefined && !EXECUTION_ID_RE.test(String(executionId))) {
    throw new VaultError(CODES.CONTEXT, 'executionId inválido.', { issues: [{ path: 'executionId', rule: 'pattern' }] });
  }
  return Object.freeze({
    tenantId,
    actor: Object.freeze({ type: actor.type, id: actor.id }),
    executionId: executionId || newExecutionId(),
  });
}

function assertContext(ctx) {
  if (!ctx || !TENANT_ID_RE.test(ctx.tenantId || '') || !EXECUTION_ID_RE.test(ctx.executionId || '')
      || !ctx.actor || !ACTOR_TYPES.includes(ctx.actor.type) || !ACTOR_ID_RE.test(ctx.actor.id || '')) {
    throw new VaultError(CODES.CONTEXT, 'Contexto de execução ausente ou inválido; use createExecutionContext().');
  }
}

module.exports = { newExecutionId, createExecutionContext, assertContext, EXECUTION_ID_RE };
