'use strict';
// #2717: fila com motivos na Central (aba Cortex).
const test = require('node:test');
const assert = require('node:assert/strict');
const { motivoDe, resumo } = require('../../netlify/functions/central/motivos');
const i = (labels, extra = {}) => ({ number: 1, labels: labels.map((name) => ({ name })), ...extra });

test('MOT1. cada rótulo vira um motivo simples', () => {
  assert.equal(motivoDe(i(['cortex-fila', 'cortex-rodando'])).codigo, 'rodando');
  assert.equal(motivoDe(i(['cortex-fila', 'cortex-travado', 'jules-enviado'])).codigo, 'jules');
  assert.equal(motivoDe(i(['cortex-fila', 'cortex-travado', 'vez-do-claude'])).codigo, 'vez-do-claude');
  assert.equal(motivoDe(i(['cortex-fila', 'cortex-reserva-sem-cota'])).codigo, 'sem-cota');
  assert.equal(motivoDe(i(['cortex-fila', 'cortex-urgente'])).codigo, 'urgente');
  assert.equal(motivoDe(i(['cortex-fila'])).texto, 'Esperando a vez na fila');
});

test('MOT2. travada mostra quantas tentativas', () => {
  assert.equal(motivoDe(i(['cortex-fila', 'cortex-travado', 'tentativa-2', 'tentativa-11'])).texto, 'Travada depois de várias tentativas (11 tentativas)');
  assert.equal(motivoDe(i(['cortex-fila', 'tentativa-1'])).texto, 'Tentando de novo (1 tentativa)');
});

test('MOT3. resumo conta por motivo e ignora PR', () => {
  const r = resumo([i(['cortex-fila']), i(['cortex-fila']), i(['cortex-fila', 'cortex-rodando']), i(['cortex-fila'], { pull_request: {} })]);
  assert.deepEqual(r.map((m) => [m.codigo, m.total]), [['fila', 2], ['rodando', 1]]);
});
