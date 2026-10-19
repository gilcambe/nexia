'use strict';
const { describe, test } = require('node:test');
const assert = require('node:assert');
const { createCache } = require('./cache');
const { createRouter } = require('./index');

function falsoProvider(chamadas) {
  return {
    id: 'falso',
    available: () => true,
    capabilities: () => ({ tool_call: false, streaming: false }),
    chat: async (_model, req) => {
      chamadas.push(req);
      return { text: `resp:${chamadas.length}`, usage: {}, provider: 'falso', model: _model };
    },
  };
}

const DESCS = [{ provider: 'falso', model: 'm' }];

describe('chatWithFallback com cache', () => {
  test('segundo pedido igual nao chama o provedor', async () => {
    const chamadas = [];
    const router = createRouter({ providers: { falso: falsoProvider(chamadas) } });
    const req = { system: 's', messages: [{ role: 'user', content: 'oi' }], cache: true };
    const r1 = await router.chatWithFallback(DESCS, req);
    const r2 = await router.chatWithFallback(DESCS, req);
    assert.strictEqual(chamadas.length, 1);
    assert.strictEqual(r1.text, 'resp:1');
    assert.strictEqual(r2.text, 'resp:1');
  });

  test('pedido com tools nunca usa cache nem armazena', async () => {
    const chamadas = [];
    const router = createRouter({ providers: { falso: falsoProvider(chamadas) } });
    const req = {
      system: 's',
      messages: [{ role: 'user', content: 'oi' }],
      cache: true,
      tools: [{ name: 'x' }],
    };
    await router.chatWithFallback(DESCS, req);
    await router.chatWithFallback(DESCS, req);
    assert.strictEqual(chamadas.length, 2);
  });

  test('sem req.cache nada muda: sempre chama o provedor', async () => {
    const chamadas = [];
    const router = createRouter({ providers: { falso: falsoProvider(chamadas) } });
    const req = { system: 's', messages: [{ role: 'user', content: 'oi' }] };
    await router.chatWithFallback(DESCS, req);
    await router.chatWithFallback(DESCS, req);
    assert.strictEqual(chamadas.length, 2);
  });

  test('item vencido eh ignorado e provedor chamado de novo', async () => {
    let tempo = 1000;
    const cache = createCache({ ttlMs: 100, agora: () => tempo });
    const chamadas = [];
    const router = createRouter({ providers: { falso: falsoProvider(chamadas) }, cache });
    const req = { system: 's', messages: [{ role: 'user', content: 'oi' }], cache: true };
    await router.chatWithFallback(DESCS, req);
    assert.strictEqual(chamadas.length, 1);
    tempo = 2000; // vence
    await router.chatWithFallback(DESCS, req);
    assert.strictEqual(chamadas.length, 2);
  });
});
