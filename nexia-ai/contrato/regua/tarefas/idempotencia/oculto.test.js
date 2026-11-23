const test = require('node:test');
const assert = require('node:assert/strict');
const solucao = require('./solucao');

test('processarFila – não muta a fila original', () => {
  const fila = ['a', 'b', 'c'];
  const antes = [...fila];
  solucao.processarFila(fila, ['b']);
  assert.deepEqual(fila, antes, 'A fila original não deve ser modificada');
});

test('processarFila – não muta o array de entregues', () => {
  const entregues = ['b'];
  const antes = [...entregues];
  solucao.processarFila(['a', 'b', 'c'], entregues);
  assert.deepEqual(entregues, antes, 'O array de entregues não deve ser modificado');
});

test('processarFila – strings vazias são valores normais', () => {
  assert.deepEqual(solucao.processarFila(['', 'foo', ''], ['']), ['foo']);
  assert.deepEqual(solucao.processarFila(['', 'foo', ''], []), ['', 'foo', '']);
  assert.deepEqual(solucao.processarFila([], ['']), []);
});

test('processarFila – entradas inválidas lançam TypeError', () => {
  assert.throws(() => solucao.processarFila(null, []), TypeError);
  assert.throws(() => solucao.processarFila(['a'], null), TypeError);
  assert.throws(() => solucao.processarFila('abc', []), TypeError);
  assert.throws(() => solucao.processarFila([], { b: 1 }), TypeError);
});
