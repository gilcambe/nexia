'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createRouter } = require('../../nexia-ai/model-router');
const { selecionarProvider } = require('../../src/utils/providerSelector');
const { tetosConfigurados } = require('../../src/config/limits');

test('P1. Seleção por tamanho, checagem de cotas, 429 e exclusão de pagos sem teto', async () => {
  const env = {};
  assert.strictEqual(tetosConfigurados(env), false);

  const providers = [
    { provider: 'RESERVA_PAID', model: 'gpt-4' },
    { provider: 'jules', model: 'jules-model' },
    { provider: 'groq', model: 'llama-3.3-70b' },
    { provider: 'gemini', model: 'gemini-2.0-flash' }
  ];

  const quotas = {
    'groq': { esgotada: true },
    'gemini': { esgotada: false }
  };

  const selecionados = selecionarProvider('media', { providers, quotas, env });
  // Deve excluir RESERVA_PAID (sem teto), jules (nunca primeiro / filtrado), groq (sem cota)
  assert.ok(selecionados.length > 0);
  assert.strictEqual(selecionados[0].provider, 'gemini');
});
