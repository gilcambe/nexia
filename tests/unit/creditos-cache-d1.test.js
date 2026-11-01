'use strict';
// #2848 créditos internos por IA e por dia; #2853 cache de respostas que sobrevive entre jobs (D1).
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMemoryDriver } = require('../../lib/firebase-lite/d1-backend');
const { createUso, carregarUsoDoD1, salvarUsoNoD1 } = require('../../nexia-ai/model-router/cota');
const { createCache, carregarCacheDoD1, salvarCacheNoD1, SETE_DIAS } = require('../../nexia-ai/model-router/cache');
const { createRouter } = require('../../nexia-ai/model-router');
const { ModelError, CODES } = require('../../nexia-ai/model-router/errors');

const HOJE = Date.parse('2026-11-01T12:00:00Z');

test('CR1. incrementUsage soma pedidos, tokens e 429; getUsage lê por provedor e dia', () => {
  const u = createUso({ agora: () => HOJE });
  u.incrementUsage('groq', { requests: 1, tokens: 100 });
  u.incrementUsage('groq', { requests: 1, errors: 1 });
  u.incrementUsage('gemini', { requests: 1, tokens: 7 });
  assert.deepEqual(u.getUsage('groq', '2026-11-01'), { requests: 2, tokens: 100, errors: 1 });
  assert.deepEqual(u.getUsage('groq', '2026-10-31'), { requests: 0, tokens: 0, errors: 0 });
  assert.deepEqual(Object.keys(u.doDia()).sort(), ['gemini', 'groq']);
});

test('CR2. dois jobs salvam no D1 sem apagar a conta um do outro', async () => {
  const driver = createMemoryDriver();
  const a = createUso({ agora: () => HOJE }); const b = createUso({ agora: () => HOJE });
  await carregarUsoDoD1({}, { driver, uso: a }); await carregarUsoDoD1({}, { driver, uso: b });
  a.incrementUsage('groq', { requests: 3, tokens: 30 });
  b.incrementUsage('groq', { requests: 2, tokens: 20, errors: 1 });
  assert.equal(await salvarUsoNoD1({}, { driver, uso: a }), true);
  assert.equal(await salvarUsoNoD1({}, { driver, uso: b }), true);
  const c = createUso({ agora: () => HOJE });
  await carregarUsoDoD1({}, { driver, uso: c });
  assert.deepEqual(c.getUsage('groq'), { requests: 5, tokens: 50, errors: 1 });
  assert.equal(await salvarUsoNoD1({}, { driver, uso: c }), false, 'nada novo, não grava');
});

test('CR3. o roteador conta cada pedido (ok e 429) no crédito do provedor', async () => {
  const uso = createUso();
  let falhar = false;
  const fake = { id: 'fake', available: () => true, capabilities: () => ({ streaming: false, tool_call: false }),
    chat: async () => { if (falhar) throw new ModelError(CODES.UPSTREAM, 'fake 429', { status: 429 }); return { text: 'oi', usage: { total_tokens: 12 } }; } };
  const r = createRouter({ env: {}, providers: { fake }, uso, cache: createCache() });
  await r.chat({ provider: 'fake', model: 'm' }, { messages: [{ role: 'user', content: 'a' }] });
  falhar = true;
  await assert.rejects(r.chat({ provider: 'fake', model: 'm' }, { messages: [{ role: 'user', content: 'b' }] }));
  assert.deepEqual(uso.getUsage('fake'), { requests: 2, tokens: 12, errors: 1 });
});

test('CR4. cache: pedido igual 2 vezes não chama a IA de novo, e volta do D1 em outro job (7 dias)', async () => {
  const driver = createMemoryDriver();
  let chamadas = 0;
  const fake = { id: 'fake', available: () => true, capabilities: () => ({ streaming: false, tool_call: false }),
    chat: async () => { chamadas++; return { text: 'resposta', usage: { total_tokens: 5 } }; } };
  const req = { cache: true, messages: [{ role: 'user', content: 'Qual a capital?' }] };
  const c1 = createCache({ ttlMs: SETE_DIAS });
  const r1 = createRouter({ env: {}, providers: { fake }, uso: createUso(), cache: c1 });
  await r1.chat({ provider: 'fake', model: 'm' }, req);
  const segunda = await r1.chat({ provider: 'fake', model: 'm' }, req);
  assert.equal(segunda.cached, true); assert.equal(chamadas, 1);
  assert.equal(await salvarCacheNoD1({}, { driver, cache: c1 }), true);
  const c2 = createCache({ ttlMs: SETE_DIAS });
  await carregarCacheDoD1({}, { driver, cache: c2 });
  const r2 = createRouter({ env: {}, providers: { fake }, uso: createUso(), cache: c2 });
  const outroJob = await r2.chat({ provider: 'fake', model: 'm' }, req);
  assert.equal(outroJob.cached, true); assert.equal(chamadas, 1);
  const [e] = Object.values(c1.exportar());
  assert.ok(e.ate - Date.now() > SETE_DIAS - 60e3, 'vale 7 dias');
});

test('CR5. sem chave do D1 não faz nada e nunca derruba', async () => {
  assert.equal(await carregarUsoDoD1({}), false);
  assert.equal(await salvarCacheNoD1({}), false);
  const quebrado = { get: async () => { throw new Error('D1 fora'); }, apply: async () => {} };
  assert.equal(await carregarCacheDoD1({}, { driver: quebrado, cache: createCache() }), false);
});
