// tests/unit/contrato-diaria.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const calculaDiaria = require('../../lib/diaria');

test('caso comum: duas diárias, uma no final de semana', () => {
  const precoBase = 100;
  const datas = ['2023-09-01', '2023-09-02']; // sexta e sábado
  const resultado = calculaDiaria(precoBase, datas);
  // sexta: 100, sábado: 100 * 1.3 = 130 => total 230.00
  assert.strictEqual(resultado, '230.00');
});

test('caso de borda: três diárias incluindo fim de semana com desconto de 10%', () => {
  const precoBase = 200;
  const datas = ['2023-09-01', '2023-09-02', '2023-09-03']; // sexta, sábado, domingo
  const resultado = calculaDiaria(precoBase, datas);
  // sexta: 200
  // sábado: 200 * 1.3 = 260
  // domingo: 200 * 1.3 = 260
  // soma = 720 -> desconto 10% = 648.00
  assert.strictEqual(resultado, '648.00');
});

test('entrada inválida: lista de datas vazia deve lançar erro', () => {
  const precoBase = 150;
  const datas = [];
  assert.throws(() => {
    calculaDiaria(precoBase, datas);
  }, /Erro|Invalid|lista vazia/i);
});
