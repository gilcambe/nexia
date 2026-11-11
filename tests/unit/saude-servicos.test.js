import test from 'node:test';
import assert from 'node:assert';

// Teste unitário para checagem de saúde de serviços com mocks de fetch (ok, erro, timeout)

async function verificarServico(url, { timeoutMs = 2000, fetchImpl = global.fetch } = {}) {
  const inicio = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(url, { signal: controller.signal });
    clearTimeout(timer);
    const ms = Date.now() - inicio;
    const ok = res.ok;
    const status = res.status;
    const resultado = { ok, status, ms, url };
    return resultado;
  } catch (err) {
    clearTimeout(timer);
    const ms = Date.now() - inicio;
    const resultado = { ok: false, status: err.name === 'AbortError' ? 408 : 500, error: err.message, ms, url };
    return resultado;
  }
}

test('verificarServico - sucesso (ok true)', async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
  });

  const res = await verificarServico('https://api.exemplo.com/health', { fetchImpl: mockFetch });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(typeof res.ms, 'number');
  assert.strictEqual(res.url, 'https://api.exemplo.com/health');
});

test('verificarServico - erro HTTP (ok false)', async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 500,
  });

  const res = await verificarServico('https://api.exemplo.com/health', { fetchImpl: mockFetch });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.status, 500);
  assert.strictEqual(typeof res.ms, 'number');
});

test('verificarServico - timeout (ok false e status 408)', async () => {
  const mockFetch = async (url, { signal } = {}) => {
    return new Promise((resolve, reject) => {
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

  const res = await verificarServico('https://api.exemplo.com/health', { timeoutMs: 50, fetchImpl: mockFetch });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.status, 408);
  assert.strictEqual(typeof res.ms, 'number');
});
