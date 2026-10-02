'use strict';
// NEXIA AI — Vault (Fase 2). Ponto de entrada único do módulo.
// Uso (servidor, Admin SDK):
//   const { createVault, createExecutionContext } = require('./nexia-ai/vault');
//   const vault = createVault({ db });
//   const ctx = createExecutionContext({ tenantId: 'nexia', actor: { type: 'user', id: uid } });
//   const { record } = await vault.Project.create(ctx, { ... }, { idempotencyKey });
const { createVault } = require('./repository');
const { createExecutionContext, newExecutionId } = require('./execution');
const { SCHEMAS, ENTITY_NAMES, SECRET_STORES, idPattern } = require('./schemas');
const { VaultError, CODES } = require('./errors');
const { detectSecret } = require('./secrets');

module.exports = {
  createVault, createExecutionContext, newExecutionId,
  SCHEMAS, ENTITY_NAMES, SECRET_STORES, idPattern,
  VaultError, CODES, detectSecret,
};
