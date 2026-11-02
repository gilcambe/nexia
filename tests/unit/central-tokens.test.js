'use strict';
// #2857 (parte 5 de #2729): card "Tokens próprios" da Central.
const test = require('node:test');
const assert = require('node:assert/strict');
const { buscar } = require('../../netlify/functions/central/tokens');
const cache = require('../../nexia-ai/model-router/cache');
const { createMemoryDriver } = require('../../lib/firebase-lite/d1-backend');

test('CT1. lê cache, cache semântico e uso de hoje do D1', async () => {
  const driver = createMemoryDriver();
  const t = new Date().toISOString();
  await driver.apply([
    { type: 'upsert', path: 'ia_cota/cache', fields: { itens: { a: {}, b: {} }, acertos: 7, economiaTokens: 3500 }, create_time: t, update_time: t },
    { type: 'upsert', path: 'ia_cota/cache_semantico', fields: { itens: [{}], acertos: 2 }, create_time: t, update_time: t },
    { type: 'upsert', path: 'ia_cota/uso', fields: { uso: { 'groq:2026-11-02': { requests: 10, tokens: 5000, errors: 1 }, 'gemini:2026-11-02': { requests: 3, tokens: 900 }, 'groq:2026-11-01': { requests: 99, tokens: 1 } } }, create_time: t, update_time: t },
  ]);
  const r = await buscar({}, { driver, hoje: '2026-11-02' });
  assert.deepEqual(r.cache, { guardadas: 2, acertos: 7, economiaTokens: 3500 });
  assert.deepEqual(r.semantico, { guardadas: 1, acertos: 2 });
  assert.deepEqual(r.usoHoje.map((u) => [u.provedor, u.pedidos, u.semCota]), [['groq', 10, 1], ['gemini', 3, 0]]);
  assert.deepEqual(r.totalHoje, { pedidos: 13, tokens: 5900 });
});

test('CT2. sem D1 diz que não está configurado', async () => {
  assert.deepEqual(await buscar({}), { configurado: false });
});

test('CT3. salvar o cache no D1 soma os acertos dos jobs', async () => {
  const driver = createMemoryDriver();
  const c = cache.createCache();
  c.set('k', { text: 'r', usage: { total_tokens: 40 } });
  c.get('k'); c.get('k');
  await cache.salvarCacheNoD1({}, { driver, cache: c });
  c.get('k');
  await cache.salvarCacheNoD1({}, { driver, cache: c });
  const doc = (await driver.get(['ia_cota/cache'])).get('ia_cota/cache');
  assert.equal(doc.fields.acertos, 3);
});
