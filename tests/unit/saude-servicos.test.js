'use strict';

const test = require('node:test');
const assert = require('node:assert');

// Função de verificação de saúde simulada / padrão inspirada no padrão do projeto
async function verificarSaudeServico(url, { timeoutMs = 1000, fetchImpl = global.fetch } = {}) {
  const inicio = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let ok = false;
  let status = 0;
  let erro = null;

  try {
    const res = await fetchImpl(url, { signal: controller.signal });
    status = res.status;
    ok = res.ok;
  } catch (err) {
    erro = err.name === 'AbortError' ? 'TIMEOUT' : err.message;
    ok = false;
  } finally {
    clearTimeout(timeoutId);
  }

  const ms = Date.now() - inicio;
  const resultado = {
    url,
    ok,
    status,
    ms,
    erro,
    timestamp: new Date().toISOString()
  };

  return resultado;
}

test('saúde de serviços: sucesso (ok: true, status 200, ms calculado)', async () => {
  const fakeFetch = async () => ({
    ok: true,
    status: 200
  });

  const res = await verificarSaudeServico('https://api.exemplo.com/health', { fetchImpl: fakeFetch });

  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.url, 'https://api.exemplo.com/health');
  assert.strictEqual(res.erro, null);
  assert.strictEqual(typeof res.ms, 'number');
  assert.ok(res.ms >= 0);
  assert.ok(typeof res.timestamp === 'string');
});

test('saúde de serviços: erro de resposta (ok: false, status 500)', async () => {
  const fakeFetch = async () => ({
    ok: false,
    status: 500
  });

  const res = await verificarSaudeServico('https://api.exemplo.com/erro', { fetchImpl: fakeFetch });

  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.status, 500);
  assert.strictEqual(res.erro, null);
  assert.strictEqual(typeof res.ms, 'number');
});

test('saúde de serviços: falha de conexão (ok: false, erro capturado)', async () => {
  const fakeFetch = async () => {
    throw new Error('Network failure');
  };

  const res = await verificarSaudeServico('https://api.exemplo.com/falha', { fetchImpl: fakeFetch });

  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.status, 0);
  assert.strictEqual(res.erro, 'Network failure');
  assert.strictEqual(typeof res.ms, 'number');
});

test('saúde de serviços: timeout (ok: false, erro TIMEOUT)', async () => {
  const fakeFetch = async (_, options) => {
    return new Promise((resolve, reject) => {
      const signal = options && options.signal;
      if (signal) {
        signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      }
      // Nunca resolve por conta própria antes do timeout
    });
  };

  const res = await verificarSaudeServico('https://api.exemplo.com/lento', {
    timeoutMs: 50,
    fetchImpl: fakeFetch
  });

  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.status, 0);
  assert.strictEqual(res.erro, 'TIMEOUT');
  assert.strictEqual(typeof res.ms, 'number');
});
