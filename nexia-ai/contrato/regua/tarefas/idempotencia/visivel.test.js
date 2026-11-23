const test = require('node:test');
const assert = require('node:assert/strict');
const solucao = require('./solucao');

test('processarFila – remove os itens já entregues', () => {
  assert.deepEqual(solucao.processarFila(['a', 'b', 'c', 'd'], ['b', 'd']), [
    'a',
    'c',
  ]);
});

test('processarFila – nada entregue devolve a fila inteira', () => {
  assert.deepEqual(solucao.processarFila(['x', 'y'], []), ['x', 'y']);
});

test('processarFila – tudo entregue devolve array vazio', () => {
  assert.deepEqual(solucao.processarFila(['a', 'b'], ['a', 'b']), []);
});

test('processarFila – fila vazia devolve array vazio', () => {
  assert.deepEqual(solucao.processarFila([], ['a']), []);
});

test('processarFila – preserva a ordem original da fila', () => {
  assert.deepEqual(solucao.processarFila(['c', 'a', 'b'], ['a']), ['c', 'b']);
});
