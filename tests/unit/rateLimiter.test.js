'use strict';
/**
 * tests/unit/rateLimiter.test.js — Teste de carga do rate limiter.
 * Dispara 11 requisições em 10s e verifica 429; verifica que o bloqueio permanece ativo.
 */
const http = require('http');
const { once } = require('events');
const app = require('../../src/app');

let server;
let port;

async function request(path, opts = {}) {
  const body = opts.body ? JSON.stringify(opts.body) : null;
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method: opts.method || 'GET',
      headers: {
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
        ...opts.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

describe('rateLimiter', () => {
  before(async () => {
    server = app.listen(0);
    await once(server, 'listening');
    port = server.address().port;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('permite 10 requisições em 10s e retorna 429 na 11ª', async () => {
    for (let i = 0; i < 10; i++) {
      const r = await request('/health');
      if (r.status !== 200) {
        throw new Error(`esperava 200 na requisição ${i + 1}, obteve ${r.status}: ${r.body}`);
      }
    }

    const r = await request('/health');
    if (r.status !== 429) {
      throw new Error(`esperava 429 na 11ª requisição, obteve ${r.status}: ${r.body}`);
    }
    if (!r.headers['retry-after']) {
      throw new Error('esperava cabeçalho Retry-After na resposta 429');
    }
    const corpo = JSON.parse(r.body);
    if (corpo.erro !== 'Muitas requisições. Tente novamente em 1 minuto.') {
      throw new Error(`mensagem inesperada: ${r.body}`);
    }
  });

  it('mantém o bloqueio ativo (429) enquanto a chave estiver bloqueada', async () => {
    // Gatilho do bloqueio: 11 requisições rápidas
    for (let i = 0; i < 11; i++) {
      await request('/health');
    }

    // As seguintes devem continuar 429 (bloqueio por 1 min)
    for (let i = 0; i < 5; i++) {
      const r = await request('/health');
      if (r.status !== 429) {
        throw new Error(`esperava 429 durante bloqueio, obteve ${r.status}: ${r.body}`);
      }
    }
  });
});
