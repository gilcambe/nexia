'use strict';
// #2854 cache semântico + #2855 encolher contexto (partes de #2729, tokens próprios).
const test = require('node:test');
const assert = require('node:assert/strict');
const { createRouter } = require('../../nexia-ai/model-router');
const { createCache } = require('../../nexia-ai/model-router/cache');
const cs = require('../../nexia-ai/model-router/cache-semantico');
const ctx = require('../../nexia-ai/model-router/contexto');
const { createMemoryDriver } = require('../../lib/firebase-lite/d1-backend');

// Embedding de mentira: perguntas com as mesmas palavras-chave ficam quase iguais.
const VOCAB = ['senha', 'trocar', 'mudar', 'conta', 'preço', 'plano'];
const embedFalso = (usados) => async (t) => { usados.push(t); const v = VOCAB.map((w) => (t.includes(w) ? 1 : 0)); if (/trocar|mudar/.test(t)) { v[1] = 1; v[2] = 1; } v.push(0.01); return v; };

function roteador(chamadas, usados, extra = {}) {
  const provider = { available: () => true, capabilities: () => ({}), chat: async (m, req) => { chamadas.push(req); return { text: 'resposta ' + chamadas.length, usage: { total_tokens: 50 } }; } };
  return createRouter({ env: {}, providers: { fake: provider }, cache: createCache(), cacheSemantico: cs.createCacheSemantico(), embed: embedFalso(usados), ...extra });
}

test('TP1. pergunta com outras palavras e mesmo sentido usa o cache semântico, sem chamar o modelo', async () => {
  const chamadas = []; const usados = [];
  const r = roteador(chamadas, usados);
  const d = { provider: 'fake', model: 'm' };
  const a = await r.chat(d, { cache: true, messages: [{ role: 'user', content: 'Como trocar a senha da conta?' }] });
  const b = await r.chat(d, { cache: true, messages: [{ role: 'user', content: 'Quero mudar minha senha da conta' }] });
  assert.equal(chamadas.length, 1);
  assert.equal(b.semantic, true);
  assert.equal(b.text, a.text);
  assert.ok(b.similaridade >= cs.LIMIAR);
  assert.equal(usados.length, 2, 'o embedding foi usado nas duas perguntas');
  const c = await r.chat(d, { cache: true, messages: [{ role: 'user', content: 'Qual o preço do plano?' }] });
  assert.notEqual(c.semantic, true);
  assert.equal(chamadas.length, 2);
});

test('TP2. sem req.cache, com conversa ou com system diferente, não reaproveita', async () => {
  assert.equal(cs.textoSemantico({ messages: [{ role: 'user', content: 'oi' }] }), null);
  assert.equal(cs.textoSemantico({ cache: true, messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }, { role: 'user', content: 'c' }] }), null);
  assert.equal(cs.textoSemantico({ cache: true, tools: [{}], messages: [{ role: 'user', content: 'a' }] }), null);
  const c = cs.createCacheSemantico();
  c.guardar([1, 0], cs.escopoDe({ system: 'A' }), { text: 'x' });
  assert.equal(c.buscar([1, 0], cs.escopoDe({ system: 'B' })), null);
  assert.equal(c.buscar([1, 0], cs.escopoDe({ system: 'A' })).valor.text, 'x');
});

test('TP3. sem chave do Workers AI o cache semântico fica desligado', () => {
  assert.equal(cs.criarEmbedWorkersAI({}), null);
  assert.equal(typeof cs.criarEmbedWorkersAI({ CLOUDFLARE_AI_TOKEN: 't', CLOUDFLARE_ACCOUNT_ID: 'c' }, async () => ({})), 'function');
  assert.equal(cs.criarEmbedWorkersAI({ CLOUDFLARE_AI_TOKEN: 't', CLOUDFLARE_ACCOUNT_ID: 'c', NEXIA_CACHE_SEMANTICO: '0' }, async () => ({})), null);
});

test('TP4. cache semântico vai e volta do D1 entre jobs', async () => {
  const driver = createMemoryDriver();
  const a = cs.createCacheSemantico();
  a.guardar([0.5, 0.5], 'e', { text: 'guardado' });
  assert.equal(await cs.salvarSemanticoNoD1({}, { driver, cache: a }), true);
  const b = cs.createCacheSemantico();
  assert.equal(await cs.carregarSemanticoDoD1({}, { driver, cache: b }), true);
  assert.equal(b.buscar([0.5, 0.5], 'e').valor.text, 'guardado');
});

test('TP5. conversa grande é resumida e fica dentro do limite; a última fala fica inteira', () => {
  const longa = 'x'.repeat(4000); // ~1000 tokens
  const messages = [];
  for (let i = 0; i < 20; i++) messages.push({ role: i % 2 ? 'assistant' : 'user', content: `${i} ${longa}` });
  messages.push({ role: 'user', content: 'pergunta final' });
  const logs = [];
  const r = ctx.encolher({ system: 'sys', messages, limiteContexto: 6000 }, {}, (l) => logs.push(l));
  assert.ok(r.depois <= 6000, `depois=${r.depois}`);
  assert.ok(r.resumidas > 0);
  assert.equal(r.req.messages.at(-1).content, 'pergunta final');
  assert.match(r.req.messages[0].content, /Resumo da conversa anterior/);
  assert.match(logs[0], /limite 6000/);
});

test('TP6. pedido pequeno ou com ferramentas não muda', () => {
  const pequeno = { messages: [{ role: 'user', content: 'oi' }] };
  assert.equal(ctx.encolher(pequeno, {}, null).req, pequeno);
  const grande = 'y'.repeat(40000);
  const comFerramenta = { limiteContexto: 1000, messages: [{ role: 'user', content: grande }, { role: 'assistant', content: '', tool_calls: [{ id: '1' }] }, { role: 'tool', content: grande }, { role: 'user', content: 'ok' }] };
  assert.equal(ctx.encolher(comFerramenta, {}, null).req, comFerramenta);
});

test('TP7. o roteador manda ao modelo o pedido já encolhido', async () => {
  const chamadas = [];
  const r = roteador(chamadas, [], { embed: null, env: { NEXIA_LIMITE_CONTEXTO: '3000' } });
  const messages = [];
  for (let i = 0; i < 12; i++) messages.push({ role: i % 2 ? 'assistant' : 'user', content: 'z'.repeat(4000) });
  messages.push({ role: 'user', content: 'fim' });
  await r.chat({ provider: 'fake', model: 'm' }, { messages });
  assert.ok(ctx.tokensDoPedido(chamadas[0]) <= 3200);
});
