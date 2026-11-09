'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPlacar } = require('../../nexia-ai/model-router/cota');
const { createRastreadorHora } = require('../../nexia-ai/model-router/limites');

test('Roteamento de cota: simulação de 429 em 3 IAs seguidas termina na 4ª sem esperar', async () => {
  const placar = createPlacar();
  const tentativas = [];

  const candidatos = [
    { provider: 'groq', model: 'llama-3.3-70b' },
    { provider: 'gemini', model: 'gemini-1.5-flash' },
    { provider: 'openrouter', model: 'deepseek-r1' },
    { provider: 'github', model: 'gpt-4o-mini' },
  ];

  const chamadaMock = async (candidato) => {
    tentativas.push(candidato.provider);
    if (candidato.provider === 'groq' || candidato.provider === 'gemini' || candidato.provider === 'openrouter') {
      const err = new Error('Rate limit reached');
      err.status = 429;
      err.retryAfter = '60s';
      throw err;
    }
    return { texto: 'Código gerado com sucesso', tokens: 1200 };
  };

  const res = await placar.executarComFallback(candidatos, chamadaMock);

  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.candidato.provider, 'github');
  assert.deepStrictEqual(tentativas, ['groq', 'gemini', 'openrouter', 'github']);
  assert.strictEqual(placar.bloqueado(candidatos[0]), true);
  assert.strictEqual(placar.bloqueado(candidatos[1]), true);
  assert.strictEqual(placar.bloqueado(candidatos[2]), true);
  assert.strictEqual(placar.bloqueado(candidatos[3]), false);
});

test('Orçamento por hora: pula modelo ao ultrapassar 90% do limite', () => {
  let agora = 1700000000000;
  const rastreador = createRastreadorHora({
    agora: () => agora,
    orcamentos: {
      groq: { requestsPerHour: 10, tokensPerHour: 10000 },
      default: { requestsPerHour: 10, tokensPerHour: 10000 },
    },
  });

  const placar = createPlacar({ agora: () => agora, rastreadorHora: rastreador });
  const desc = { provider: 'groq', model: 'llama-3' };

  assert.strictEqual(placar.bloqueado(desc), false);

  // Consumir 9 requests de 10 (90%)
  rastreador.registrarConsumo('groq', { requests: 9, tokens: 5000 });
  const status = rastreador.quantoResta('groq', agora);
  assert.strictEqual(status.quaseEsgotado, true);
  assert.strictEqual(status.restaNestaHora.requests, 1);
  assert.strictEqual(placar.bloqueado(desc), true);
});

test('Se todas as IAs estiverem sem cota, devolve tentar-depois com timestamp', async () => {
  const placar = createPlacar();
  const candidatos = [
    { provider: 'groq', model: 'llama' },
    { provider: 'gemini', model: 'flash' },
  ];

  const chamadaFalhaTudo = async () => {
    const err = new Error('Rate limit exceeded');
    err.status = 429;
    throw err;
  };

  const res = await placar.executarComFallback(candidatos, chamadaFalhaTudo);
  assert.strictEqual(res.ok, false);
  assert.ok(res.tentarDepois);
  assert.ok(typeof res.proximoResetMs === 'number');
});

test('Card da Central: retorna "resta X nesta hora" para cada provedor', () => {
  const rastreador = createRastreadorHora();
  rastreador.registrarConsumo('gemini', { requests: 3, tokens: 12000 });

  const card = rastreador.cardCentral();
  assert.ok(card.gemini);
  assert.match(card.gemini.label, /Resta \d+ reqs/);
  assert.strictEqual(typeof card.gemini.restaRequests, 'number');
});
