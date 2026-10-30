'use strict';

const { createVault, VaultError, CODES } = require('../../nexia-ai/vault');

/**
 * Detecta se o erro indica indisponibilidade do Vault / Firestore.
 */
const isUnavailable = e => !!e && (
  e.code === 'UNAVAILABLE' ||
  e.code === 14 ||
  e.code === 503 ||
  e.status === 'UNAVAILABLE' ||
  /UNAVAILABLE|Firestore.*indisponível|indisponível para o Vault/i.test(`${e.code || ''} ${e.status || ''} ${e.message || ''}`)
);

/**
 * Executa uma função com retries e backoff exponencial em caso de erro UNAVAILABLE do Vault.
 */
async function withVaultRetry(fn, { maxRetries = 2, initialDelay = 50 } = {}) {
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
 * Encapsula a criação do cliente do Vault com resiliência contra "Vault UNAVAILABLE".
 */
function wrapWithRetry(vault, retryOpts = {}) {
  if (!vault || typeof vault !== 'object') return vault;
  const wrapped = {};
  for (const [entityName, repo] of Object.entries(vault)) {
    if (!repo || typeof repo !== 'object') {
      wrapped[entityName] = repo;
      continue;
    }
    const wrappedRepo = {};
    for (const [methodName, fn] of Object.entries(repo)) {
      if (typeof fn === 'function') {
        wrappedRepo[methodName] = function (...args) {
          const run = () => fn.apply(repo, args);
          try {
            const res = run();
            if (res && typeof res.then === 'function') {
              return withVaultRetry(() => Promise.resolve(run()), retryOpts);
            }
            return res;
          } catch (e) {
            if (isUnavailable(e)) {
              return withVaultRetry(() => Promise.resolve().then(run), retryOpts);
            }
            throw e;
          }
        };
      } else {
        wrappedRepo[methodName] = fn;
      }
    }
    wrapped[entityName] = Object.freeze(wrappedRepo);
  }
  return Object.freeze(wrapped);
}

function getVaultClient(options = {}, retryOpts = {}) {
  const vault = createVault(options);
  return wrapWithRetry(vault, retryOpts);
}

module.exports = {
  createVault,
  getVaultClient,
  withVaultRetry,
  isUnavailable,
  VaultError,
  CODES
};
