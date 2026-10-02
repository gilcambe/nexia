'use strict';
// Erros do Vault. As mensagens citam só caminhos de campo e regras, nunca valores
// (um valor pode ser um secret colado por engano).

class VaultError extends Error {
  /**
   * @param {string} code  código estável (ver CODES)
   * @param {string} message  texto sem valores de campo
   * @param {object} [details]  { issues: [{ path, rule }] } etc., também sem valores
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'VaultError';
    this.code = code;
    this.details = details;
  }
}

const CODES = Object.freeze({
  VALIDATION: 'VALIDATION',                 // schema inválido
  SECRET_DETECTED: 'SECRET_DETECTED',       // valor parece secret
  NOT_FOUND: 'NOT_FOUND',
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  REFERENCE: 'REFERENCE',                   // integridade referencial
  HAS_DEPENDENTS: 'HAS_DEPENDENTS',         // soft-delete bloqueado por filhos ativos
  UNIQUE: 'UNIQUE',                         // valor único já usado
  VERSION_CONFLICT: 'VERSION_CONFLICT',     // controle de concorrência
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  DELETED: 'DELETED',                       // operação em registro soft-deleted
  SCHEMA_VERSION: 'SCHEMA_VERSION',         // documento com schemaVersion desconhecido
  CONTEXT: 'CONTEXT',                       // contexto de execução inválido
  UNAVAILABLE: 'UNAVAILABLE',               // Firestore indisponível
});

module.exports = { VaultError, CODES };
