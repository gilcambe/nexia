'use strict';
// Melhoria 20: o Cortex não refaz tarefa que já tem PR aberto (o #102 do ZeloMe gerou 3 PRs iguais).
const test = require('node:test');
const assert = require('node:assert');
const { prAbertoDoContrato, ramoDoContrato } = require('../../nexia-ai/contrato/pr');

test('acha o PR aberto da mesma tarefa', () => {
  const pulls = [{ number: 7, head: { ref: 'nexia/contrato-10-abc' } }, { number: 9, head: { ref: ramoDoContrato(102) } }];
  assert.strictEqual(prAbertoDoContrato(pulls, 102).number, 9);
  assert.strictEqual(prAbertoDoContrato(pulls, '10').number, 7);
});

test('não confunde tarefa 10 com 102 nem com outros ramos', () => {
  const pulls = [{ number: 1, head: { ref: 'nexia/contrato-102-x' } }, { number: 2, head: { ref: 'nexia/gildivan-10' } }];
  assert.strictEqual(prAbertoDoContrato(pulls, 10), null);
});

test('resposta estranha da API não derruba', () => {
  assert.strictEqual(prAbertoDoContrato(null, 5), null);
  assert.strictEqual(prAbertoDoContrato({ message: 'erro' }, 5), null);
  assert.strictEqual(prAbertoDoContrato([null, {}, { head: {} }], 5), null);
});
