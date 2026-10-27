'use strict';
// Teste: provedor mock demora 6s para o primeiro chunk e envia chunks de
// "reasoning" a cada 500ms. O streamWithFallback deve entregar a resposta
// completa sem disparar fallback (timeout de 12s para esse provedor).
const test = require('node:test');
const assert = require('node:assert');
const { createRouter } = require('../../nexia-ai/model-router');

const ENV = { ANTHROPIC_API_KEY: 'chave-de-teste-anthropic' };
const PROVIDER_ID = 'mock-slow';
const MODEL = 'mock-slow-model';

function makeSlowProvider() {
  return {
    id: PROVIDER_ID,
    envKey: 'MOCK_SLOW_API_KEY',
    available: () => true,
    capabilities: () => ({ chat: true, streaming: true, tool_call: false }),
    async *stream(model, req) {
      // demora 6s para enviar o primeiro chunk de texto
      await new Promise(r => setTimeout(r, 6000));
      const reasoningChunks = ['raciocínio ', 'passo ', 'um', ', ', 'passo ', 'dois', '.'];
      for (const c of reasoningChunks) {
        yield { type: 'text', text: c };
        await new Promise(r => setTimeout(r, 500));
      }
      yield { type: 'done', usage: { total_tokens: 10 }, stop_reason: 'stop' };
    },
    async chat(model, req) {
      return { text: 'resposta completa', usage: {}, stop_reason: 'stop' };
    }
  };
}

test('provedor lento entrega resposta completa sem fallback (timeout 12s)', async () => {
  const provider = makeSlowProvider();
  const router = createRouter({
    env: ENV,
    providers: { [PROVIDER_ID]: provider }
  });
  const desc = { provider: PROVIDER_ID, model: MODEL };
  const start = Date.now();
  const events = [];
  for await (const e of router.streamWithFallback(
    [desc],
    { messages: [{ role: 'user', content: 'oi' }] },
    { firstChunkTimeoutMs: 12000 }
  )) {
    events.push(e);
  }
  const elapsed = Date.now() - start;
  const texts = events.filter(e => e.type === 'text').map(e => e.text).join('');
  assert.strictEqual(texts, 'raciocínio passo um, passo dois.');
  assert.ok(events.find(e => e.type === 'done'), 'fluxo terminou com done');
  assert.ok(!events.find(e => e.type === 'error'), 'não houve erro de fallback');
  // não houve fallback: apenas um provedor usado, attempts vazio
  const modelEvent = events.find(e => e.type === 'model');
  assert.ok(modelEvent, 'evento de modelo emitido');
  assert.deepStrictEqual(modelEvent.attempts, []);
  // o primeiro chunk chegou após 6s e antes do timeout de 12s
  assert.ok(elapsed >= 6000, `esperado >= 6000ms, obteve ${elapsed}ms`);
  assert.ok(elapsed < 12000, `esperado < 12000ms (timeout usado), obteve ${elapsed}ms`);
});
