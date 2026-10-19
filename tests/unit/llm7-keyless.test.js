'use strict';
// Item 4: LLM7.io sem chave — fetchImpl falso. Sem chave, o pedido vai sem
// cabeçalho Authorization. Nenhuma chave real, nenhuma rede externa.
const test = require('node:test');
const assert = require('node:assert');
const { createRouter } = require('../../nexia-ai/model-router');

test('LLM7 keyless: available() é true sem chave e o pedido vai sem Authorization', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, auth: init.headers.Authorization });
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'ok', role: 'assistant' } }], usage: {} }),
    };
  };

  const env = {}; // sem LLM7_API_KEY
  const r = createRouter({ env, fetchImpl });

  // Item 3: provedor keyless sem chave está disponível (reaproveita a lógica do Kilo).
  assert.strictEqual(r.capabilities({ provider: 'llm7', model: 'codestral-latest' }).available, true);

  const out = await r.chat({ provider: 'llm7', model: 'codestral-latest' }, {
    messages: [{ role: 'user', content: 'oi' }],
  });
  assert.strictEqual(out.text, 'ok');

  // O pedido foi feito (sem rede real) e sem cabeçalho Authorization.
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].url, 'https://api.llm7.io/v1/chat/completions');
  assert.strictEqual(calls[0].auth, undefined, 'sem chave → sem cabeçalho Authorization');

  // Mesma coisa com a segunda entrada do TAIL.
  await r.chat({ provider: 'llm7', model: 'gpt-oss-20b' }, { messages: [{ role: 'user', content: 'x' }] });
  assert.strictEqual(calls.length, 2);
  assert.strictEqual(calls[1].auth, undefined);
});
