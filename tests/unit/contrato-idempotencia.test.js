// tests/unit/contrato-idempotencia.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const solucao = require('../../nexia-ai/contrato/regua/tarefas/idempotencia/solucao');

// Caso comum: itens mistos, alguns já entregues
test('processarFila – caso comum', () => {
  const fila = ['a', 'b', 'c', 'd'];
  const entregues = ['b', 'd'];
  const resultado = solucao.processarFila(fila, entregues);
  assert.deepEqual(resultado, ['a', 'c']);
});

// Caso de borda: fila vazia ou entregues vazios
test('processarFila – borda (filas vazias)', () => {
  const filaVazia = [];
  const entreguesVazia = [];
  assert.deepEqual(solucao.processarFila(filaVazia, entreguesVazia), []);

  const fila = ['x'];
  assert.deepEqual(solucao.processarFila(fila, []), ['x']);
});

// Entrada inválida: parâmetros não são arrays
test('processarFila – entrada inválida', () => {
  assert.throws(() => solucao.processarFila(null, []), TypeError);
  assert.throws(() => solucao.processarFila(['a'], null), TypeError);
});

// Garantia de não mutação da fila original
test('processarFila – não muta a fila original', () => {
  const fila = ['a', 'b'];
  const clone = [...fila];
  solucao.processarFila(fila, []);
  assert.deepEqual(fila, clone, 'A fila original não deve ser modificada');
});

// Strings vazias são tratadas como valores normais
test('processarFila – strings vazias', () => {
  const fila = ['', 'foo', ''];
  const entregues = [''];
  const resultado = solucao.processarFila(fila, entregues);
  assert.deepEqual(resultado, ['foo']);
});
