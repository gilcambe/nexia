'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { comCacheDeBorda, ttlDe } = require('../../cloudflare/cacheBorda.js');

function cacheFalso() {
  const m = new Map();
  return { m, match: async (r) => { const x = m.get(r.url); return x ? x.clone() : undefined; }, put: async (r, resp) => { m.set(r.url, resp); } };
}
const ctx = () => { const ps = []; return { ps, waitUntil: (p) => ps.push(p) }; };
const ok = (n) => async () => { n.v++; return new Response('{"a":1}', { status: 200, headers: { 'Content-Type': 'application/json' } }); };

test('CB1. só GET público das rotas da lista tem tempo de cache', () => {
  const u = 'https://x.dev/api/firebase-config';
  assert.strictEqual(ttlDe(new Request(u), {}), 300);
  assert.strictEqual(ttlDe(new Request(u, { method: 'POST', body: '{}' }), {}), 0);
  assert.strictEqual(ttlDe(new Request(u, { headers: { Authorization: 'Bearer x' } }), {}), 0);
  assert.strictEqual(ttlDe(new Request(u, { headers: { Cookie: 's=1' } }), {}), 0);
  assert.strictEqual(ttlDe(new Request('https://x.dev/api/pedidos'), {}), 0);
  assert.strictEqual(ttlDe(new Request(u), { NEXIA_CACHE_BORDA: '0' }), 0);
});

test('CB2. 2º pedido sai do cache (HIT) sem chamar o handler', async () => {
  const c = cacheFalso(); const n = { v: 0 }; const k = ctx();
  const r1 = await comCacheDeBorda(new Request('https://x.dev/api/firebase-config'), {}, k, ok(n), c);
  await Promise.all(k.ps);
  assert.strictEqual(r1.headers.get('X-Nexia-Cache'), 'MISS');
  assert.strictEqual(await r1.text(), '{"a":1}');
  const r2 = await comCacheDeBorda(new Request('https://x.dev/api/firebase-config'), {}, k, ok(n), c);
  assert.strictEqual(r2.headers.get('X-Nexia-Cache'), 'HIT');
  assert.strictEqual(await r2.text(), '{"a":1}');
  assert.strictEqual(n.v, 1);
});

test('CB3. cabeçalho X-Nexia-Proxy separa a chave do cache', async () => {
  const c = cacheFalso(); const n = { v: 0 };
  await comCacheDeBorda(new Request('https://x.dev/api/firebase-config'), {}, undefined, ok(n), c);
  await comCacheDeBorda(new Request('https://x.dev/api/firebase-config', { headers: { 'X-Nexia-Proxy': '1' } }), {}, undefined, ok(n), c);
  assert.strictEqual(n.v, 2);
  assert.strictEqual(c.m.size, 2);
});

test('CB4. erro (503) não é guardado; rota fora da lista passa direto', async () => {
  const c = cacheFalso(); let n = 0;
  const falha = async () => { n++; return new Response('x', { status: 503 }); };
  await comCacheDeBorda(new Request('https://x.dev/api/firebase-config'), {}, undefined, falha, c);
  assert.strictEqual(c.m.size, 0);
  const r = await comCacheDeBorda(new Request('https://x.dev/api/pedidos'), {}, undefined, falha, c);
  assert.strictEqual(r.status, 503); assert.strictEqual(c.m.size, 0);
});

test('CB5. sem Cache API (Node, testes) só chama o handler', async () => {
  const n = { v: 0 };
  const r = await comCacheDeBorda(new Request('https://x.dev/api/firebase-config'), {}, undefined, ok(n), null);
  assert.strictEqual(r.status, 200); assert.strictEqual(n.v, 1);
});
