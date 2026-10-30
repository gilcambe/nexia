'use strict';

const { runJob: baseRunJob, isQuota: baseIsQuota, bothExhausted: baseBothExhausted } = require('../../nexia-ai/jobs/runner');

/**
 * Detecta se o erro indica que o Vault / Firestore está indisponível (UNAVAILABLE, 503, código 14).
 */
const isUnavailable = e => !!e && (
  e.code === 'UNAVAILABLE' ||
  e.code === 14 ||
  e.code === 503 ||
  e.status === 'UNAVAILABLE' ||
  /UNAVAILABLE|Firestore.*indisponível|indisponível para o Vault/i.test(`${e.code || ''} ${e.status || ''} ${e.message || ''}`)
);

function vaultUnavailable(e) {
  return Object.assign(
    new Error(`VAULT_UNAVAILABLE: Vault indisponível nos bancos de dados (${String(e && e.message || '').slice(0, 120)})`),
    { code: 'VAULT_UNAVAILABLE', cause: e }
  );
}

/**
 * Executa uma função com retries e backoff exponencial.
 */
async function runWithRetry(fn, maxRetries = 2, initialDelay = 50) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (e) {
      if (!isUnavailable(e) || attempt >= maxRetries) throw e;
      attempt++;
      const delay = initialDelay * Math.pow(2, attempt - 1);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

/**
 * Executa o job com suporte a retries com backoff em caso de "Vault UNAVAILABLE" e fallback do banco B para o principal.
 */
async function runJob(rawJob, deps = {}) {
  const maxRetries = deps.maxRetries !== undefined ? deps.maxRetries : 2;
  const initialDelay = deps.initialDelay !== undefined ? deps.initialDelay : 50;

  try {
    return await runWithRetry(() => baseRunJob(rawJob, deps), maxRetries, initialDelay);
  } catch (e) {
    if (isUnavailable(e)) {
      if (deps.vdb && deps.vdb !== deps.db && !deps.vault) {
        console.warn('[nexia-job] Vault do banco B indisponível; tentando o banco principal');
        try {
          return await runWithRetry(() => baseRunJob(rawJob, { ...deps, vdb: deps.db }), maxRetries, initialDelay);
        } catch (e2) {
          throw isUnavailable(e2) ? vaultUnavailable(e2) : baseIsQuota(e2) ? baseBothExhausted(e2) : e2;
        }
      }
      throw vaultUnavailable(e);
    }
    throw e;
  }
}

module.exports = {
  runJob,
  isQuota: baseIsQuota,
  isUnavailable,
  bothExhausted: baseBothExhausted,
  vaultUnavailable
};
