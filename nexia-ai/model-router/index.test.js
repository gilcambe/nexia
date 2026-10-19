'use strict';
const { describe, test } = require('node:test');
const assert = require('node:assert');
const { createRouter } = require('./index');
const { createCache } = require('./cache');

function providerFalso(contador) {
  return {
    id: 'falso',
    envKey: 'FALSO_KEY',
    available: () => true,
    capabilities: () => ({}),
    chat: async (_model, req) => {
      contador.chamadas++;
      return {
        text: `resp ${contador.chamadas}`,
        usage: {},
        provider: 'falso',
        model: req.model || 'm',
      };
    },
  };
}

describe('chatWithFallback com cache', () => {
  test('segundo pedido igual com cache:true nao chama o provedor', async () => {
    const contador = { chamadas: 0 };
    const router = createRouter({ providers: { falso: providerFalso(contador) } });
    const req = { cache: true, system: 's', messages: [{ role: 'user', content: 'oi' }] };
    const d = { provider: 'falso', model: 'm' };
    const r1 = await router.chatWithFallback([d], req);
    assert.strictEqual(r1.text, 'resp 1');
    const r2 = await router.chatWithFallback([d], req);
    assert.strictEqual(r2.text, 'resp 1');
    assert.strictEqual(contador.chamadas, 1);
  });

  test('pedido com tools nunca usa cache nem armazena', async () => {
    const contador = { chamadas: 0 };
    const router = createRouter({ providers: { falso: providerFalso(contador) } });
    const req = {
      cache: true,
      system: 's',
      messages: [{ role: 'user', content: 'oi' }],
      tools: [{ name: 'x' }],
    };
    const d = { provider: 'falso', model: 'm' };
    await router.chatWithFallback([d], req);
    await router.chatWithFallback([d], req);
    assert.strictEqual(contador.chamadas, 2);
  });

  test('sem req.cache nada muda (provedor chamado toda vez)', async () => {
    const contador = { chamadas: 0 };
    const router = createRouter({ providers: { falso: providerFalso(contador) } });
    const req = { system: 's', messages: [{ role: 'user', content: 'oi' }] };
    const d = { provider: 'falso', model: 'm' };
    await router.chatWithFallback([d], req);
    await router.chatWithFallback([d], req);
    assert.strictEqual(contador.chamadas, 2);
  });

  test('item vencido eh ignorado e o provedor e chamado novamente', async () => {
    let tempo = 1000;
    const contador = { chamadas: 0 };
    const cache = createCache({ ttlMs: 100, agora: () => tempo });
    const router = createRouter({
      providers: { falso: providerFalso(contador) },
      cache,
    });
    const req = { cache: true, system: 's', messages: [{ role: 'user', content: 'oi' }] };
    const d = { provider: 'falso', model: 'm' };
    await router.chatWithFallback([d], req);
    assert.strictEqual(contador.chamadas, 1);
    tempo = 2000; // vence a entrada
    await router.chatWithFallback([d], req);
    assert.strictEqual(contador.chamadas, 2);
  });
});
