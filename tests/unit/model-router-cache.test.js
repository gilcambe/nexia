'use strict';
// #956 cache de 24 h (sem ferramentas) e #955 catálogo vivo da OpenRouter (só ":free").
const test = require('node:test');
const assert = require('node:assert');
const { createCache, chave, cacheavel } = require('../../nexia-ai/model-router/cache');
const { createRouter } = require('../../nexia-ai/model-router');
const { createKiloCatalog, pickFree } = require('../../nexia-ai/model-router/providers/kilo-catalog');
const { createOpenAICompatibleProvider } = require('../../nexia-ai/model-router/providers/openai-compatible');

const fakeProvider = () => {
  const p = { id: 'fake', calls: 0, available: () => true, capabilities: () => ({ chat: true, tool_call: true }),
    async chat(model) { p.calls++; return { text: `resposta ${p.calls}`, provider: 'fake', model, usage: {} }; } };
  return p;
};
const REQ = { system: 's', messages: [{ role: 'user', content: 'divida' }] };

test('MC1. segundo pedido igual (cache: true, sem tools) não chama o provedor', async () => {
  const p = fakeProvider();
  const r = createRouter({ env: {}, providers: { fake: p } });
  const d = { provider: 'fake', model: 'm' };
  const a = await r.chat(d, { ...REQ, cache: true });
  const b = await r.chat(d, { ...REQ, cache: true });
  assert.strictEqual(p.calls, 1);
  assert.strictEqual(b.text, a.text);
  assert.strictEqual(b.cached, true);
  await r.chat(d, REQ);
  assert.strictEqual(p.calls, 2, 'sem req.cache nada muda');
});

test('MC2. pedido com tools nunca usa cache', async () => {
  const p = fakeProvider();
  const r = createRouter({ env: {}, providers: { fake: p } });
  const req = { ...REQ, cache: true, tools: [{ name: 't', description: 'x', input_schema: { type: 'object' } }] };
  await r.chat({ provider: 'fake', model: 'm' }, req);
  await r.chat({ provider: 'fake', model: 'm' }, req);
  assert.strictEqual(p.calls, 2);
  assert.strictEqual(cacheavel(req), false);
});

test('MC3. item vencido (24 h) é ignorado; chave = sha256 de system+messages', () => {
  let t = 0;
  const c = createCache({ agora: () => t });
  const k = chave(REQ);
  assert.match(k, /^[0-9a-f]{64}$/);
  assert.strictEqual(chave({ ...REQ, maxTokens: 9 }), k);
  c.set(k, 'v');
  t = 24 * 3600e3 - 1; assert.strictEqual(c.get(k), 'v');
  t = 24 * 3600e3 + 1; assert.strictEqual(c.get(k), undefined);
  const small = createCache({ max: 2 });
  small.set('a', 1); small.set('b', 2); small.get('a'); small.set('c', 3);
  assert.deepStrictEqual([small.get('a'), small.get('b'), small.get('c')], [1, undefined, 3], 'sai o menos usado');
});

const CATALOGO = { data: [
  { id: 'paga/grande', context_length: 999999, supported_parameters: ['tools'] },
  { id: 'a/pequeno:free', context_length: 8000, supported_parameters: ['tools'] },
  { id: 'b/sem-tools:free', context_length: 500000, supported_parameters: ['temperature'] },
  { id: 'c/grande:free', context_length: 128000, supported_parameters: ['tools'] },
] };

test('MC4. OpenRouter auto:1 = primeiro :free com tools (maior contexto); modelo sem :free nunca é escolhido', async () => {
  assert.deepStrictEqual(pickFree(CATALOGO, { ordem: 'contexto' }), ['c/grande:free', 'a/pequeno:free']);
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url, auth: init.headers.Authorization });
    if (/\/models$/.test(url)) return { ok: true, status: 200, json: async () => CATALOGO };
    const body = JSON.parse(init.body);
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ model: body.model, choices: [{ message: { content: `ok ${body.model}` }, finish_reason: 'stop' }], usage: {} }) };
  };
  const p = createOpenAICompatibleProvider('openrouter', { env: { OPENROUTER_API_KEY: 'k', KILO_API_KEY: 'kilo-secreta' }, fetchImpl });
  const out = await p.chat('auto:1', { messages: [{ role: 'user', content: 'oi' }] });
  assert.match(out.text, /c\/grande:free/);
  assert.strictEqual(seen[0].url, 'https://openrouter.ai/api/v1/models');
  assert.ok(!String(seen[0].auth || '').includes('kilo-secreta'), 'a chave do Kilo não vai para a OpenRouter');
  await assert.rejects(p.chat('auto:3', { messages: [{ role: 'user', content: 'oi' }] }), /sem o modelo/);
  await assert.rejects(p.chat('paga/grande', { messages: [{ role: 'user', content: 'oi' }] }), /só modelos grátis/);
});

test('MC5. createKiloCatalog sem url continua no Kilo', async () => {
  let url;
  const c = createKiloCatalog({ fetchImpl: async u => { url = u; return { ok: true, json: async () => ({ data: [{ id: 'x/y:free' }] }) }; } });
  assert.deepStrictEqual((await c.list()).ids, ['x/y:free']);
  assert.strictEqual(url, 'https://api.kilo.ai/api/gateway/models');
});
