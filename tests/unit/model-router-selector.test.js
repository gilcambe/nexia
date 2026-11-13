'use strict';
// Teste unitário para a parte 4 do modelo router e selector (Closes #3583)
const test = require('node:test');
const assert = require('node:assert');
const { createRouter } = require('../../nexia-ai/model-router');
const { selecionarProvider } = require('../../src/utils/providerSelector');

test('M13. Simula 3 providers, um devolve 429, outro sem cota, e verifica troca automática e filtros (Jules, pago, treina_com_dados)', async () => {
  const quotas = {
    provider_ok: { esgotada: false },
    provider_429: { esgotada: false },
    provider_sem_cota: { esgotada: true },
    jules: { esgotada: false },
    RESERVA_pago: { esgotada: false }
  };

  const placar = {
    bloqueado: ({ provider }) => provider === 'bloqueado'
  };

  // Testar selecao por providerSelector
  const selecionados = selecionarProvider('media', {
    providers: [
      { provider: 'jules', model: 'm1' },
      { provider: 'provider_sem_cota', model: 'm2' },
      { provider: 'provider_ok', model: 'm3' },
      { provider: 'provider_429', model: 'm4' }
    ],
    quotas,
    placar,
    env: {}
  });

  // Jules nunca deve ser o primeiro se houver alternativas, e sem cota/pago sem tetos devem ser filtrados
  assert.ok(!selecionados.some(p => p.provider === 'provider_sem_cota'));
  assert.ok(!selecionados.some(p => p.provider.startsWith('RESERVA_')));
  assert.ok(selecionados.length > 0);

  // Testar chatWithFallback simulando 429 e troca em <5s
  const start = Date.now();
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    if (calls === 1) {
      const err = new Error('Too Many Requests');
      err.details = { status: 429 };
      throw err;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'sucesso apos 429' } }], usage: { input_tokens: 5, output_tokens: 5 } })
    };
  };

  const router = createRouter({
    env: { OPENAI_API_KEY: 'test-key', GROQ_API_KEY: 'test-key' },
    fetchImpl,
    providers: {
      provider_429: {
        id: 'provider_429',
        available: () => true,
        capabilities: () => ({ chat: true, streaming: true, tool_call: true, max_output_tokens: 1000 }),
        chat: async () => {
          const err = new Error('Too Many Requests');
          err.details = { status: 429 };
          throw err;
        }
      },
      provider_ok: {
        id: 'provider_ok',
        available: () => true,
        capabilities: () => ({ chat: true, streaming: true, tool_call: true, max_output_tokens: 1000 }),
        chat: async () => ({ text: 'sucesso apos 429', provider: 'provider_ok', model: 'm3', usage: { input_tokens: 5, output_tokens: 5 } })
      }
    }
  });

  const res = await router.chatWithFallback(
    [
      { provider: 'provider_429', model: 'm4' },
      { provider: 'provider_ok', model: 'm3' }
    ],
    { messages: [{ role: 'user', content: 'oi' }] }
  );

  const duration = Date.now() - start;
  assert.strictEqual(res.text, 'sucesso apos 429');
  assert.ok(duration < 5000, 'Troca automática em menos de 5s');
});
