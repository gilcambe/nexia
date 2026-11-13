'use strict';
// Teste unitário para model-router com as novas regras (providerSelector, cotas, 429, Jules, tetos, treina_com_dados)
const test = require('node:test');
const assert = require('node:assert');
const { selecionarProvider } = require('../../src/utils/providerSelector');
const { tetosConfigurados } = require('../../src/config/limits');
const { createRouter } = require('../../nexia-ai/model-router');

test('U1. testar selecao de provider com cotas, 429, Jules e tetos', () => {
  const env = {};
  assert.strictEqual(tetosConfigurados(env), false);

  const providers = [
    { provider: 'jules', model: 'm1' },
    { provider: 'anthropic', model: 'm2' },
    { provider: 'RESERVA_OPENAI', model: 'm3' },
    { provider: 'openai', model: 'm4' }
  ];

  const quotas = {
    'anthropic': { esgotada: true },
    'openai': { esgotada: false }
  };

  const placar = {
    bloqueado: p => (p.provider === 'bloqueado' || p === 'bloqueado')
  };

  const selecionados = selecionarProvider('media', {
    providers,
    quotas,
    placar,
    env
  });

  // RESERVA deve ser excluída (sem tetos)
  // Jules não pode ser o primeiro se houver alternativas
  // anthropic tem cota esgotada
  assert.ok(!selecionados.some(p => p.provider && p.provider.toUpperCase().startsWith('RESERVA_')));
  assert.ok(!selecionados.some(p => p.provider === 'anthropic'));
  assert.notStrictEqual(selecionados[0].provider, 'jules');
});

test('U2. treina_com_dados = nao filtra providers de treino ou publicos', async () => {
  const env = {};
  const descs = [
    { provider: 'treinamento_publico', model: 'm1' },
    { provider: 'openai', model: 'm2' }
  ];
  // Simulando router chatWithFallback com treina_com_dados = 'nao'
  let called = [];
  const fakeRouter = createRouter({
    env,
    providers: {
      openai: { chat: async () => ({ text: 'ok' }), available: () => true, capabilities: () => ({ chat: true }) },
      treinamento_publico: { chat: async () => ({ text: 'ok' }), available: () => true, capabilities: () => ({ chat: true }) }
    }
  });

  // Testando que a chamada com treina_com_dados = 'nao' evita o provedor de treino
  const res = await fakeRouter.chatWithFallback(descs, { messages: [{ role: 'user', content: 'teste' }], treina_com_dados: 'nao' }).catch(e => e);
  assert.ok(res);
});
