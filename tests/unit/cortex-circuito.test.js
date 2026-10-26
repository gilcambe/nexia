'use strict';
// #821 (Melhoria C3): roteador por tarefa e por saúde. Quem falha seguidas vezes é rebaixado por 1 hora.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createPlacar, CIRCUITO_FALHAS } = require('../../nexia-ai/model-router/cota');
const { FREE } = require('../../nexia-ai/orchestrator/models');

const A = { provider: 'groq', model: 'a' };
const B = { provider: 'google', model: 'b' };

test('C3a. 3 falhas seguidas por instabilidade abrem o disjuntor por 5 minutos (#1631)', () => {
  let t = 0;
  const p = createPlacar({ agora: () => t });
  for (let i = 0; i < CIRCUITO_FALHAS - 1; i++) p.marcar(A, 'transient');
  assert.equal(p.bloqueado(A), false, 'antes da 3ª falha segue no rodízio');
  p.marcar(A, 'transient');
  assert.equal(p.bloqueado(A), true);
  assert.deepEqual(p.ordenar([A, B]), [B], 'rebaixado: o próximo modelo vai primeiro');
  t += 4 * 60e3; assert.equal(p.bloqueado(A), true);
  t += 2 * 60e3; assert.equal(p.bloqueado(A), false, 'volta depois de 5 minutos');
});

test('C3b. sucesso no meio zera a conta; castigo curto não encurta o disjuntor', () => {
  let t = 0;
  const p = createPlacar({ agora: () => t });
  p.marcar(A, 'busy'); p.marcar(A, 'busy'); p.sucesso(A); p.marcar(A, 'busy');
  t += 3 * 60e3;
  assert.equal(p.bloqueado(A), false, 'só 1 falha depois do sucesso: castigo de 2 min já passou');
  p.marcar(A, 'busy'); p.marcar(A, 'busy');
  assert.equal(p.exportar()['groq|a'].motivo, 'circuito');
  p.marcar(A, 'busy');
  assert.ok(p.exportar()['groq|a'].ate - t >= 4 * 60e3, 'busy (2 min) não encurta os 5 min');
  assert.deepEqual(p.ordenar([A]), [A], 'todos bloqueados: lista nunca fica vazia');
});

test('C3c. cada tipo de tarefa tem a sua cadeia grátis (código, raciocínio, rápido)', () => {
  assert.equal(FREE.coding[0].provider, 'groq');
  assert.equal(FREE.reasoning[0].provider, 'google');
  assert.equal(FREE.fast[0].provider, 'mistral');
  for (const l of Object.values(FREE)) assert.ok(!l.some(d => d.provider === 'anthropic'), 'nada pago nas cadeias grátis');
});
