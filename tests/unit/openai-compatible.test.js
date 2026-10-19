'use strict';
const { strict: assert } = require('node:assert');
const { describe: describe, it: it } = require('node:test');
const { createOpenAICompatibleProvider } = require('../../nexia-ai/model-router/providers/openai-compatible');

describe('model-router/providers/openai-compatible (llm7 keyless)', () => {
  it('available() é true sem chave para provedor keyless', () => {
    const p = createOpenAICompatibleProvider('llm7', { env: {} });
    assert.strictEqual(p.available(), true);
    assert.strictEqual(p.envKey, 'LLM7_API_KEY');
  });

  it('sem chave, o pedido vai sem cabeçalho Authorization', async () => {
    let capturado;
    const fetchImpl = async (url, opts) => {
      capturado = { url, headers: opts.headers };
      return {
        ok: true,
        status: 200,
        headers: {},
        json: async () => ({
          id: 'chatcmpl-test',
          model: 'codestral-latest',
          choices: [{ index: 0, message: { role: 'assistant', content: 'olá' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 3 },
        }),
      };
    };

    const p = createOpenAICompatibleProvider('llm7', { env: {}, fetchImpl });
    const res = await p.chat('codestral-latest', { messages: [{ role: 'user', content: 'oi' }] });
    assert.strictEqual(res.text, 'olá');
    assert.ok(capturado, 'fetchImpl deveria ter sido chamado');
    assert.strictEqual(capturado.url, 'https://api.llm7.io/v1/chat/completions');
    assert.strictEqual(capturado.headers.Authorization, undefined);
    assert.strictEqual(capturado.headers['Content-Type'], 'application/json');
  });

  it('com chave, o pedido envia Authorization Bearer', async () => {
    let capturado;
    const fetchImpl = async (url, opts) => {
      capturado = opts.headers;
      return {
        ok: true,
        status: 200,
        headers: {},
        json: async () => ({
          id: 'x',
          model: 'codestral-latest',
          choices: [{ index: 0, message: { role: 'assistant', content: 'k' }, finish_reason: 'stop' }],
          usage: {},
        }),
      };
    };

    const p = createOpenAICompatibleProvider('llm7', { env: { LLM7_API_KEY: 'sk-test' }, fetchImpl });
    await p.chat('codestral-latest', { messages: [{ role: 'user', content: 'oi' }] });
    assert.strictEqual(capturado.Authorization, 'Bearer sk-test');
  });
});
