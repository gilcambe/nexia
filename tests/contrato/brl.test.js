'use strict';
// Contrato de prova do executor (11/11/2026): este teste FALHA até lib/brl.js existir e estar certo.
// Fica fora de tests/unit/ (o CI não roda) porque é o pedido para o Cortex resolver.
const test = require('node:test');
const assert = require('node:assert/strict');
const { brl, centavos } = require('../../lib/brl');

test('brl formata reais no padrão brasileiro', () => {
  assert.equal(brl(1490), 'R$ 1.490,00');
  assert.equal(brl(59.9), 'R$ 59,90');
  assert.equal(brl(0), 'R$ 0,00');
  assert.equal(brl(1234567.891), 'R$ 1.234.567,89');
  assert.equal(brl(-12.5), '-R$ 12,50');
});

test('centavos lê o que a pessoa digita e devolve inteiro em centavos', () => {
  assert.equal(centavos('1.490,00'), 149000);
  assert.equal(centavos('59,9'), 5990);
  assert.equal(centavos('R$ 10'), 1000);
  assert.equal(centavos('abc'), null);
  assert.equal(centavos(''), null);
});
