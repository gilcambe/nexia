import test from 'node:test';
import assert from 'node:assert';
import { Miniflare } from 'miniflare';
import { generateTestToken } from '../lib/cortex-cliente.js';

test('Cortex Cliente Worker Endpoints', async (t) => {
  const mf = new Miniflare({
    modules: true,
    script: `
      import { authenticate, generateTestToken } from './lib/cortex-cliente.js';
      
      export default {
        async fetch(request, env, ctx) {
          const url = new URL(request.url);
          if (url.pathname === '/api/cortex-cliente/conversas') {
            const mockRes = {
              status(code) {
                this.statusCode = code;
                return this;
              },
              json(body) {
                this.body = body;
                return new Response(JSON.stringify(body), {
                  status: this.statusCode || 200,
                  headers: { 'Content-Type': 'application/json' }
                });
              }
            };
            
            let responded = false;
            const mockNext = () => {
              responded = true;
              return new Response(JSON.stringify({ conversations: [{ id: '1', uid: req.user.uid }] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              });
            };

            const req = {
              headers: Object.fromEntries(request.headers.entries())
            };

            const result = authenticate(req, mockRes, mockNext);
            if (result instanceof Response) return result;
            if (responded) return mockNext();
            return mockRes.body ? new Response(JSON.stringify(mockRes.body), { status: mockRes.statusCode }) : new Response('OK');
          }
          return new Response('Not Found', { status: 404 });
        }
      };
    `,
    compatibilityDate: '2024-01-01',
  });

  await mf.ready();

  const tokenA = generateTestToken('uidA');
  const tokenB = generateTestToken('uidB');

  await t.test('1) GET /api/cortex-cliente/conversas com token de uidA retorna 200 e dados do uidA', async () => {
    const res = await mf.dispatchFetch('http://localhost/api/cortex-cliente/conversas', {
      headers: {
        Authorization: `Bearer ${tokenA}`
      }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.conversations);
    assert.strictEqual(data.conversations[0].uid, 'uidA');
  });

  await t.test('2) GET /api/cortex-cliente/conversas com token de uidB retorna 403', async () => {
    const res = await mf.dispatchFetch('http://localhost/api/cortex-cliente/conversas', {
      headers: {
        Authorization: `Bearer ${tokenB}`
      }
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('3) GET /api/cortex-cliente/conversas sem header Authorization retorna 401', async () => {
    const res = await mf.dispatchFetch('http://localhost/api/cortex-cliente/conversas');
    assert.strictEqual(res.status, 401);
  });

  await mf.dispose();
});
