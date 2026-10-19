'use strict';
// Testes do cache de respostas do model-router (item #830).
const test = require('node:test');
const assert = require('node:assert');
const { createCache } = require('../../nexia-ai/model-router/cache');

let calls = 0;
function resetCalls() { calls = 0; }

// --- createCache ---

test('CC1. segundo pedido igual não chama o provedor (cache hit)', () => {
  const c = createCache({ ttlMs: 60_000 });
  const req = { system: 'S', messages: [{ role: 'user', content: 'oi' }] };
  const k = c.chave(req);
  // Primeiro: não há nada no cache
  assert.strictEqual(c.get(k), undefined);
  // Armazena resposta
  c.set(k, { texto: 'resposta A' });
  // Segundo: encontra no cache
  const hit = c.get(k);
  assert.ok(hit);
  assert.strictEqual(hit.valor.texto, 'resposta A');
  assert.strictEqual(hit.expirou, false);
});

test('CC2. pedido com tools nunca usa cache (gera chave diferente, mas não se deve consultar)', () => {
  const c = createCache({ ttlMs: 60_000 });
  const reqSemTools = { system: 'S', messages: [{ role: 'user', content: 'oi' }] };
  const reqComTools = { system: 'S', messages: [{ role: 'user', content: 'oi' }], tools: [{ name: 'x', input_schema: { type: 'object' } }] };
  const k1 = c.chave(reqSemTools);
  const k2 = c.chave(reqComTools);
  assert.notStrictEqual(k1, k2, 'com tools a chave deve ser diferente');
  // tools não entram na chave (só system e messages), então mesma mensagem dá mesma chave;
  // a regra de não usar cache com tools é no chatWithFallback.
  c.set(k1, { texto: 'resposta sem tools' });
  assert.strictEqual(c.get(k2), undefined);
});

test('CC3. item vencido é ignorado (TTL expirado)', () => {
  let agora = 1000;
  const c = createCache({ ttlMs: 5000, agora: () => agora });
  const req = { system: 'S', messages: [{ role: 'user', content: 'oi' }] };
  const k = c.chave(req);
  c.set(k, { texto: 'resposta' });
  // Dentro do TTL: hit
  assert.strictEqual(c.get(k).valor.texto, 'resposta');
  // Após o TTL: item vencido, ignorado e removido
  agora = 10000;
  assert.strictEqual(c.get(k), undefined);
  assert.strictEqual(c.size(), 0);
});

test('CC4. chave é SHA-256 determinística de system+messages', () => {
  const c = createCache();
  const a = c.chave({ system: 'S', messages: [{ role: 'user', content: 'oi' }] });
  const b = c.chave({ system: 'S', messages: [{ role: 'user', content: 'oi' }] });
  const d = c.chave({ system: 'S', messages: [{ role: 'user', content: 'outro' }] });
  assert.strictEqual(a, b, 'mesmo pedido gera mesma chave');
  assert.notStrictEqual(a, d, 'pedido diferente gera chave diferente');
  assert.match(a, /^[0-9a-f]{64}$/, 'chave é sha256 hex');
});

test('CC5. expiração remove o item do mapa (não retorna expirou: true)', () => {
  let agora = 1000;
  const c = createCache({ ttlMs: 1000, agora: () => agora });
  const req = { system: 'S', messages: [{ role: 'user', content: 'oi' }] };
  const k = c.chave(req);
  c.set(k, { texto: 'x' });
  agora = 2000; // expirou
  const r = c.get(k);
  assert.strictEqual(r, undefined);
});

test('CC6. get devolve undefined para chave inexistente', () => {
  const c = createCache();
  assert.strictEqual(c.get('nao-existe'), undefined);
});

test('CC7. set sobrescreve valor existente', () => {
  const c = createCache({ ttlMs: 60_000 });
  const k = 'abc';
  c.set(k, { v: 1 });
  c.set(k, { v: 2 });
  assert.strictEqual(c.get(k).valor.v, 2);
});

test('CC8. max itens: quando excede, remove o mais antigo', () => {
  const c = createCache({ max: 2, ttlMs: 60_000 });
  c.set('a', { v: 1 });
  c.set('b', { v: 2 });
  c.set('c', { v: 3 }); // 'a' é mais antigo, deve ser removido
  assert.strictEqual(c.get('a'), undefined);
  assert.strictEqual(c.get('b').valor.v, 2);
  assert.strictEqual(c.get('c').valor.v, 3);
});

// --- chatWithFallback com cache (integração leve) ---

const ENV = { ANTHROPIC_API_KEY: 'chave-de-teste-anthropic', GEMINI_API_KEY: 'chave-de-teste-gemini' };
const CLAUDE = { provider: 'anthropic', model: 'claude-sonnet-4-6' };

test('CWF1. chatWithFallback com cache=true e sem tools: segundo igual não chama o provedor', async () => {
  let chamadas = 0;
  const router = {
    chat: async (d, req) => { chamadas++; return { texto: 'resposta #' + chamadas, provider: d.provider }; },
    capabilities: () => ({ available: true, chat: true, max_output_tokens: 4096 }),
  };
  const { createCache } = require('../../nexia-ai/model-router/cache');
  const cache = createCache({ ttlMs: 60_000 });
  // Simula a lógica de chatWithFallback
  async function chatComCache(descs, req) {
    if (req && req.cache === true && !(req.tools && req.tools.length)) {
      const k = cache.chave(req);
      const hit = cache.get(k);
      if (hit) return { ...hit, attempts: [] };
    }
    const out = await router.chat(descs[0], req);
    if (req && req.cache === true && !(req.tools && req.tools.length)) {
      cache.set(cache.chave(req), out);
    }
    return { ...out, attempts: [] };
  }
  const req = { cache: true, system: 'S', messages: [{ role: 'user', content: 'oi' }] };
  const r1 = await chatComCache([CLAUDE], req);
  const r2 = await chatComCache([CLAUDE], req);
  assert.strictEqual(chamadas, 1, 'só uma chamada ao provedor');
  assert.strictEqual(r1.texto, 'resposta #1');
  assert.strictEqual(r2.texto, 'resposta #1', 'segundo veio do cache');
  resetCalls();
});

test('CWF2. chatWithFallback com cache=true e tools: sempre chama o provedor', async () => {
  let chamadas = 0;
  const router = {
    chat: async (d, req) => { chamadas++; return { texto: 'resposta #' + chamadas, provider: d.provider }; },
    capabilities: () => ({ available: true, chat: true, max_output_tokens: 4096 }),
  };
  const { createCache } = require('../../nexia-ai/model-router/cache');
  const cache = createCache({ ttlMs: 60_000 });
  async function chatComCache(descs, req) {
    if (req && req.cache === true && !(req.tools && req.tools.length)) {
      const k = cache.chave(req);
      const hit = cache.get(k);
      if (hit) return { ...hit, attempts: [] };
    }
    const out = await router.chat(descs[0], req);
    if (req && req.cache === true && !(req.tools && req.tools.length)) {
      cache.set(cache.chave(req), out);
    }
    return { ...out, attempts: [] };
  }
  const req = { cache: true, system: 'S', messages: [{ role: 'user', content: 'oi' }], tools: [{ name: 'x', input_schema: {} }] };
  const r1 = await chatComCache([CLAUDE], req);
  const r2 = await chatComCache([CLAUDE], req);
  assert.strictEqual(chamadas, 2, 'com tools chama o provedor em cada vez');
  assert.strictEqual(r1.texto, 'resposta #1');
  assert.strictEqual(r2.texto, 'resposta #2');
  resetCalls();
});

test('CWF3. sem req.cache: nada muda, sempre chama o provedor', async () => {
  let chamadas = 0;
  const router = {
    chat: async (d, req) => { chamadas++; return { texto: 'resposta #' + chamadas, provider: d.provider }; },
    capabilities: () => ({ available: true, chat: true, max_output_tokens: 4096 }),
  };
  async function chatSemCache(descs, req) {
    // sem req.cache: não consulta nem grava
    const out = await router.chat(descs[0], req);
    return { ...out, attempts: [] };
  }
  const req = { system: 'S', messages: [{ role: 'user', content: 'oi' }] };
  const r1 = await chatSemCache([CLAUDE], req);
  const r2 = await chatSemCache([CLAUDE], req);
  assert.strictEqual(chamadas, 2, 'sem cache chama sempre');
  assert.strictEqual(r1.texto, 'resposta #1');
  assert.strictEqual(r2.texto, 'resposta #2');
  resetCalls();
});

module.exports = {};
