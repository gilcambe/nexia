'use strict';
// #3377 (13/11/2026): livro de cotas por IA, lido do que o roteador grava no D1. Nunca inventa número.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMemoryDriver } = require('../../lib/firebase-lite/d1-backend');
const { montarLivro, lerLivro, podeDadoDeCliente } = require('../../nexia-ai/model-router/livro');
const { createPlacar, createUso, salvarNoD1, salvarUsoNoD1 } = require('../../nexia-ai/model-router/cota');

const AGORA = Date.parse('2026-11-13T12:00:00Z');

test('LV1. sem D1 = "sem dados", sem número inventado', async () => {
  const r = await lerLivro({});
  assert.deepEqual(r.linhas, []); assert.equal(r.fonte, 'sem dados');
  assert.equal(montarLivro({}, AGORA).fonte, 'sem dados');
});

test('LV2. junta uso de hoje/ontem e bloqueios vigentes por provedor; ignora castigo vencido', () => {
  const r = montarLivro({
    uso: { 'groq:2026-11-13': { requests: 40, tokens: 9000, errors: 2 }, 'groq:2026-11-12': { requests: 10 }, 'gemini:2026-11-01': { requests: 99 } },
    placar: { 'openrouter|x:free': { ate: AGORA + 60000, motivo: 'daily' }, 'groq|velho': { ate: AGORA - 1, motivo: 'rate' }, _cache_stats: { hits: 1 } },
  }, AGORA);
  const g = r.linhas.find((l) => l.provedor === 'groq');
  assert.deepEqual(g.hoje, { pedidos: 40, tokens: 9000, semCota: 2 }); assert.equal(g.ontem.pedidos, 10);
  assert.equal(g.bloqueados.length, 0); assert.equal(g.situacao, 'ativa');
  const o = r.linhas.find((l) => l.provedor === 'openrouter');
  assert.equal(o.bloqueados[0].modelo, 'x:free'); assert.match(o.bloqueados[0].motivo, /cota do dia/); assert.equal(o.situacao, 'sem-cota');
  assert.equal(r.linhas.some((l) => l.provedor === 'gemini'), false, 'uso antigo não aparece');
  assert.equal(r.linhas[0].provedor, 'groq', 'quem mais usou vem primeiro');
});

test('LV3. regra 6: dado de cliente só vai a quem não treina com ele', () => {
  assert.equal(podeDadoDeCliente('groq'), true);
  assert.equal(podeDadoDeCliente('gemini'), false);
  assert.equal(podeDadoDeCliente('openrouter'), false);
  assert.equal(podeDadoDeCliente('desconhecido'), false);
});

test('LV4. lê o que o roteador salvou no D1 (ida e volta)', async () => {
  const driver = createMemoryDriver();
  const placar = createPlacar({ agora: () => Date.now() }); placar.marcar({ provider: 'groq', model: 'llama' }, 'daily');
  const uso = createUso(); uso.incrementUsage('groq', { requests: 3, tokens: 100 });
  const qualidade = { importar() {}, exportar() { return {}; } };
  assert.equal(await salvarNoD1({}, { driver, placar, qualidade }), true);
  assert.equal(await salvarUsoNoD1({}, { driver, uso }), true);
  const r = await lerLivro({}, { driver });
  const g = r.linhas.find((l) => l.provedor === 'groq');
  assert.equal(g.hoje.pedidos, 3); assert.equal(g.bloqueados[0].modelo, 'llama'); assert.ok(r.atualizadoEm);
});
