'use strict';
// Contrato: acrescentar parcelas() em lib/brl.js SEM quebrar brl() e centavos().
const test = require('node:test');
const assert = require('node:assert/strict');
const { brl, centavos, parcelas } = require('../../lib/brl');
test('parcelas divide centavos sem perder nenhum (a diferença vai nas primeiras)', () => {
  assert.deepEqual(parcelas(10000, 3), [3334, 3333, 3333]);
  assert.deepEqual(parcelas(149000, 2), [74500, 74500]);
  assert.deepEqual(parcelas(5, 3), [2, 2, 1]);
  assert.equal(parcelas(99999, 7).reduce((a, b) => a + b, 0), 99999);
  assert.throws(() => parcelas(100, 0));
});
test('brl e centavos continuam funcionando', () => {
  assert.equal(brl(1490), 'R$ 1.490,00');
  assert.equal(centavos('59,9'), 5990);
});
