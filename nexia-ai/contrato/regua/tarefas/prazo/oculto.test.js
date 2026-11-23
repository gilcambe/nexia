'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { processarPeloPrazo } = require('./solucao');

test('retorna lista vazia se a fila estiver vazia', () => {
  const relogio = { agora: () => 0 };
  const naoProcessados = processarPeloPrazo([], 10, relogio, () => {});
  assert.deepStrictEqual(naoProcessados, []);
});

test('para imediatamente se o estouro de prazo ocorrer logo no início', () => {
  const fila = ['item1', 'item2'];
  let tempoAtual = 0;
  const relogio = {
    agora: () => tempoAtual,
  };

  const processarItem = (item) => {
    tempoAtual += 15;
  };

  const naoProcessados = processarPeloPrazo(fila, 10, relogio, processarItem);
  assert.deepStrictEqual(naoProcessados, ['item2']);
});
