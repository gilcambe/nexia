'use strict';
// Erros do Model Router. A mensagem é segura para log; nunca carrega chave nem corpo
// completo do provedor (só um trecho curto em details.upstream, para diagnóstico).
const CODES = Object.freeze({
  NO_API_KEY: 'NO_API_KEY',
  UNKNOWN_PROVIDER: 'UNKNOWN_PROVIDER',
  UNSUPPORTED: 'UNSUPPORTED',
  UPSTREAM: 'UPSTREAM',
  ABORTED: 'ABORTED',
  INVALID_OUTPUT: 'INVALID_OUTPUT',
  ALL_FAILED: 'ALL_FAILED',
});

class ModelError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ModelError';
    this.code = code;
    this.details = details;
  }
}

module.exports = { ModelError, CODES };
