'use strict';
// Testes para #1632: Cortex Qualidade Q4 (Roteamento por dificuldade, cache e placar)
const test = require('node:test');
const assert = require('node:assert/strict');
const { classificarDificuldade, podeUsarCache } = require('../../nexia-ai/cortex/classificador');
const { createRouter } = require('../../nexia-ai/model-router');
const { getSharedCache, createCache } = require('../../nexia-ai/model-router/cache');
const { getPlacar } = require('../../nexia-ai/model-router/cota');

test('Q4-1. Classificação por dificuldade sem IA: simples vs difícil', () => {
  // Simples
  assert.equal(classificarDificuldade('oi, bom dia!'), 'simples');
  assert.equal(classificarDificuldade('quanto é 2+2?'), 'simples');
  assert.equal(classificarDificuldade('o que é SaaS?'), 'simples');

  // Difícil
  assert.equal(classificarDificuldade('corrija este código: ```js\nfunction test() {}\n```'), 'dificil');
  assert.equal(classificarDificuldade('explique a arquitetura e refatore o banco de dados firestore'), 'dificil');
  assert.equal(classificarDificuldade('qual a previsão?', { ragEnabled: true }), 'dificil');
  assert.equal(classificarDificuldade('x'.repeat(350)), 'dificil');
});

test('Q4-2. Conversa com histórico NUNCA usa cache', () => {
  assert.equal(podeUsarCache('o que é HTML?', { historyLength: 0 }), true);
  assert.equal(podeUsarCache('o que é HTML?', { historyLength: 1 }), false);
  assert.equal(podeUsarCache('o que é HTML?', { historyLength: 5 }), false);
  assert.equal(podeUsarCache('o que é HTML?', { context: [{ role: 'user', content: 'oi' }] }), false);
});

test('Q4-3. Mensagem com dados pessoais NUNCA usa cache', () => {
  assert.equal(podeUsarCache('meu email e usuario@exemplo.com'), false);
  assert.equal(podeUsarCache('meu cpf e 123.456.789-00'), false);
  assert.equal(podeUsarCache('qual o status da minha conta?'), false);
  assert.equal(podeUsarCache('meus dados cadastrais'), false);
  assert.equal(podeUsarCache('qual o horário de funcionamento?'), true);
});

test('Q4-4. Teste de carga/latência: pergunta repetida responde em < 300 ms e usa o cache', async () => {
  let chamadasProvedor = 0;
  const providers = {
    fast: {
      capabilities: () => ({ streaming: true }),
      available: () => true,
      async *stream() {
        chamadasProvedor++;
        yield { type: 'text', text: 'SaaS é Software as a Service.' };
        yield { type: 'done', usage: { total_tokens: 20 } };
      }
    }
  };

  const cache = createCache();
  const router = createRouter({ providers, cache });
  const req = { system: 'Sistema', messages: [{ role: 'user', content: 'o que e saas?' }], cache: true };
  const descs = [{ provider: 'fast', model: 'm1' }];

  // 1ª execução: Miss de cache, chama provedor
  const evs1 = [];
  for await (const ev of router.streamWithFallback(descs, req)) {
    evs1.push(ev);
  }
  assert.equal(chamadasProvedor, 1);
  const texto1 = evs1.filter(e => e.type === 'text').map(e => e.text).join('');
  assert.equal(texto1, 'SaaS é Software as a Service.');

  // 2ª execução: Hit de cache
  const startMs = Date.now();
  const evs2 = [];
  for await (const ev of router.streamWithFallback(descs, req)) {
    evs2.push(ev);
  }
  const durationMs = Date.now() - startMs;

  assert.equal(chamadasProvedor, 1, 'Provedor não deve ser chamado no 2º pedido');
  assert.ok(durationMs < 300, `Latência do cache foi ${durationMs}ms (esperado < 300ms)`);

  const evModel = evs2.find(e => e.type === 'model');
  assert.ok(evModel && evModel.cached === true, 'Evento de modelo deve marcar cached: true');

  const texto2 = evs2.filter(e => e.type === 'text').map(e => e.text).join('');
  assert.equal(texto2, 'SaaS é Software as a Service.');
});

test('Q4-5. Placar registra economia de cota no cache', () => {
  const sharedCache = getSharedCache();
  sharedCache.resetStats();

  const placar = getPlacar();
  assert.equal(placar.economiaCache().hits, 0);

  sharedCache.set('key-teste', { text: 'Resposta guardada', usage: { total_tokens: 200 } });
  sharedCache.get('key-teste');

  const stats = placar.economiaCache();
  assert.equal(stats.hits, 1);
  assert.equal(stats.economiaTokens, 200);

  const exp = placar.exportar();
  assert.ok(exp._cache_stats);
  assert.equal(exp._cache_stats.hits, 1);
});
