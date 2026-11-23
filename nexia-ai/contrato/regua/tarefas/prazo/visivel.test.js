'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { processarPeloPrazo } = require('./solucao');

test('processa itens dentro do prazo usando relógio injetado', () => {
  const fila = ['item1', 'item2', 'item3'];
  let tempoAtual = 0;
  const relogio = {
    agora: () => tempoAtual,
  };

  // Simula que cada item gasta 10 unidades de tempo e o limite é 25
  const processarItem = (item) => {
    tempoAtual += 10;
  };

  const naoProcessados = processarPeloPrazo(fila, 25, relogio, processarItem);
  assert.deepStrictEqual(naoProcessados, ['item3']);
});
