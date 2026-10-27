'use strict';
// Helper: chama a API real do GitHub com retentativa em 403/429/5xx.
// Esperas: 2s, 5s, 10s (3 tentativas). Se ainda for 403 sem cota
// (x-ratelimit-remaining: 0 ou mensagem "GitHub respondeu 403"),
// pula o teste em vez de falhar. Qualquer outro erro continua falhando.
const ESPERAS = [2000, 5000, 10000];

// Testes de unidade para comRetentativa
if (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined') {
  const { test } = require('node:test');
  const assert = require('node:assert');
  
  // Mock para simular setTimeout controlado
  let mockTimeoutDelay = 0;
  let mockTimeoutCallback = null;
  
  // Sobrescreve setTimeout para testes
  global.setTimeout = (callback, delay) => {
    mockTimeoutDelay = delay;
    mockTimeoutCallback = callback;
    return { mockTimeoutDelay, mockTimeoutCallback };
  };
  
  // Função para avançar o tempo nos testes
  const advanceTime = (ms) => {
    if (mockTimeoutCallback) {
      mockTimeoutCallback();
      mockTimeoutCallback = null;
    }
  };
  
  // Teste: sucesso na primeira tentativa
  test('comRetentativa - sucesso na primeira tentativa', async () => {
    const mockFn = async () => ({ status: 200, data: 'success' });
    const mockT = { skip: () => {} };
    
    const result = await comRetentativa(mockFn, mockT);
    
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.data, 'success');
  });
  
  // Teste: retentativa com sucesso na segunda tentativa (403)
  test('comRetentativa - sucesso na segunda tentativa (403)', async () => {
    let callCount = 0;
    const mockFn = async () => {
      callCount++;
      if (callCount === 1) {
        const error = new Error('Rate limit');
        error.status = 403;
        throw error;
      }
      return { status: 200, data: 'success' };
    };
    const mockT = { skip: () => {} };
    
    const result = await comRetentativa(mockFn, mockT);
    
    assert.strictEqual(callCount, 2);
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.data, 'success');
    assert.strictEqual(mockTimeoutDelay, 2000); // Primeira espera
  });
  
  // Teste: retentativa com sucesso na terceira tentativa (429)
  test('comRetentativa - sucesso na terceira tentativa (429)', async () => {
    let callCount = 0;
    const mockFn = async () => {
      callCount++;
      if (callCount <= 2) {
        const error = new Error('Too many requests');
        error.status = 429;
        throw error;
      }
      return { status: 200, data: 'success' };
    };
    const mockT = { skip: () => {} };
    
    const result = await comRetentativa(mockFn, mockT);
    
    assert.strictEqual(callCount, 3);
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.data, 'success');
    assert.strictEqual(mockTimeoutDelay, 10000); // Terceira espera
  });
  
  // Teste: erro 5xx propagado após 3 tentativas
  test('comRetentativa - erro 5xx propagado após 3 tentativas', async () => {
    let callCount = 0;
    const mockFn = async () => {
      callCount++;
      const error = new Error('Server error');
      error.status = 500;
      throw error;
    };
    const mockT = { skip: () => {} };
    
    await assert.rejects(
      comRetentativa(mockFn, mockT),
      /Server error/
    );
    
    assert.strictEqual(callCount, 3);
  });
  
  // Teste: skip quando 403 com x-ratelimit-remaining: 0
  test('comRetentativa - skip quando 403 com x-ratelimit-remaining: 0', async () => {
    let callCount = 0;
    const mockFn = async () => {
      callCount++;
      const error = new Error('Rate limit exceeded');
      error.status = 403;
      error.headers = { 'x-ratelimit-remaining': '0' };
      throw error;
    };
    let skipCalled = false;
    const mockT = { skip: () => { skipCalled = true; } };
    
    const result = await comRetentativa(mockFn, mockT);
    
    assert.strictEqual(callCount, 3);
    assert.strictEqual(skipCalled, true);
    assert.strictEqual(result, undefined);
  });
  
  // Teste: skip quando 403 com mensagem "GitHub respondeu 403"
  test('comRetentativa - skip quando mensagem "GitHub respondeu 403"', async () => {
    let callCount = 0;
    const mockFn = async () => {
      callCount++;
      const error = new Error('GitHub respondeu 403');
      error.status = 403;
      throw error;
    };
    let skipCalled = false;
    const mockT = { skip: () => { skipCalled = true; } };
    
    const result = await comRetentativa(mockFn, mockT);
    
    assert.strictEqual(callCount, 3);
    assert.strictEqual(skipCalled, true);
    assert.strictEqual(result, undefined);
  });
  
  // Teste: erro não-rate limit propagado imediatamente
  test('comRetentativa - erro não-rate limit propagado imediatamente', async () => {
    const mockFn = async () => {
      const error = new Error('Not found');
      error.status = 404;
      throw error;
    };
    const mockT = { skip: () => {} };
    
    await assert.rejects(
      comRetentativa(mockFn, mockT),
      /Not found/
    );
  });
}

function ehRateLimit(status) {
  return status === 403 || status === 429 || (status >= 500 && status <= 599);
}

function semCota(status, headers, mensagem) {
  if (status !== 403) return false;
  const rem = headers && (headers['x-ratelimit-remaining'] === '0' || headers['x-ratelimit-remaining'] === 0);
  return rem || /GitHub respondeu 403/.test(mensagem);
}

function extrair(erro, resultado) {
  let status, headers, mensagem;
  if (erro) {
    status = erro.status ?? erro.response?.status;
    headers = erro.headers ?? erro.response?.headers;
    mensagem = erro.message;
  } else if (resultado && typeof resultado.status === 'number') {
    status = resultado.status;
    headers = resultado.headers;
    mensagem = `GitHub respondeu ${status}`;
  }
  return { status, headers, mensagem };
}

async function comRetentativa(fn, t) {
  let ultimoErro;
  for (let i = 0; i < 3; i++) {
    let resultado;
    let erro;
    try {
      resultado = await fn();
    } catch (e) {
      erro = e;
      ultimoErro = e;
    }

    const { status, headers, mensagem } = extrair(erro, resultado);

    if (status !== undefined && ehRateLimit(status)) {
      if (i === 2) {
        if (semCota(status, headers, mensagem)) {
          t.skip('GitHub sem cota agora');
          return undefined;
        }
        throw ultimoErro;
      }
      await new Promise(resolve => setTimeout(resolve, ESPERAS[i]));
      continue;
    }

    if (erro) throw ultimoErro;
    return resultado;
  }
  throw ultimoErro;
}

module.exports = { comRetentativa };
