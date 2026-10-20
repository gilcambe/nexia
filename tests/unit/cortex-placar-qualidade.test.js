'use strict';
// #832 (Melhoria C14): placar de qualidade por modelo e por tipo de tarefa ordena a cadeia grátis.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createQualidade, getQualidade, MIN_AMOSTRAS } = require('../../nexia-ai/model-router/qualidade');
const { createPlacar, carregarDoD1, salvarNoD1 } = require('../../nexia-ai/model-router/cota');
const { candidates } = require('../../nexia-ai/orchestrator/models');

const A = { provider: 'groq', model: 'a' }, B = { provider: 'google', model: 'b' }, C = { provider: 'mistral', model: 'c' };

test('C14a. comprovado ruim desce, comprovado bom sobe, sem dados mantém a ordem', () => {
  const q = createQualidade();
  assert.deepEqual(q.ordenar([A, B, C], 'coding'), [A, B, C]);
  for (let i = 0; i < MIN_AMOSTRAS + 2; i++) { q.registrar(A, 'coding', false); q.registrar(C, 'coding', true); }
  assert.deepEqual(q.ordenar([A, B, C], 'coding'), [C, B, A]);
  assert.deepEqual(q.ordenar([A, B, C], 'fast'), [A, B, C], 'cada tipo de tarefa tem o seu placar');
  q.registrar(B, 'coding', false);
  assert.equal(q.taxa(B, 'coding'), null, 'poucas tentativas: ainda não conta');
});

test('C14b. o placar vai e volta do D1 junto com o de cota', async () => {
  const docs = new Map();
  const driver = { get: async ([p]) => new Map(docs.has(p) ? [[p, docs.get(p)]] : []), apply: async ops => { for (const o of ops) docs.set(o.path, { fields: o.fields, create_time: o.create_time }); } };
  const q1 = createQualidade();
  for (let i = 0; i < 4; i++) q1.registrar(A, 'coding', false);
  assert.equal(await salvarNoD1({}, { driver, placar: createPlacar(), qualidade: q1 }), true);
  const q2 = createQualidade();
  await carregarDoD1({}, { driver, placar: createPlacar(), qualidade: q2 });
  assert.deepEqual(q2.ordenar([A, B], 'coding'), [B, A]);
  assert.equal(q2.placar()[0].tentativas, 4);
});

test('C14c. candidates() usa o placar de qualidade; falta de cota não conta como falha', () => {
  const router = { capabilities: () => ({ available: true, tool_call: true }) };
  const env = { NEXIA_MODELS_FAST: 'groq:a,google:b' };
  const q = getQualidade(); q.limpar();
  assert.deepEqual(candidates(router, 'fast', env), [A, B]);
  for (let i = 0; i < 5; i++) q.registrar(A, 'fast', false);
  assert.deepEqual(candidates(router, 'fast', env), [B, A]);
  q.limpar();
  const src = require('fs').readFileSync(require('path').join(__dirname, '../../nexia-ai/orchestrator/runtime.js'), 'utf8');
  assert.match(src, /SEM_CULPA = new Set\(\['rate', 'daily', 'tpm', 'too_large'\]\)/);
});
