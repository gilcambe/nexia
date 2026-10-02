'use strict';
/**
 * safe-error — respostas de erro sem detalhes internos (SEC Fase 1, A5).
 * O detalhe vai para o log do servidor com um correlation ID; o cliente recebe
 * só uma mensagem genérica e o mesmo ID para suporte.
 */
const crypto = require('crypto');

function newCorrelationId() {
  return crypto.randomBytes(8).toString('hex');
}

function logError(scope, err, correlationId = newCorrelationId()) {
  const msg = err && err.message ? err.message : String(err);
  console.error(`[${scope}] correlationId=${correlationId} ${msg}`);
  if (err && err.stack && process.env.NODE_ENV !== 'production') console.error(err.stack);
  return correlationId;
}

function publicErrorBody(scope, err, message = 'Erro interno. Tente novamente.') {
  const correlationId = logError(scope, err);
  return { error: message, correlationId };
}

module.exports = { newCorrelationId, logError, publicErrorBody };
