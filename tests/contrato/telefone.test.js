'use strict';
// Contrato de prova do último degrau (plano Claude Pro): lib/telefone.js formata telefone brasileiro para exibir.
const test = require('node:test');
const assert = require('node:assert/strict');
const { formatar } = require('../../lib/telefone');
test('formatar telefone brasileiro', () => {
  assert.equal(formatar('11988887777'), '(11) 98888-7777');
  assert.equal(formatar('1133334444'), '(11) 3333-4444');
  assert.equal(formatar('+55 (21) 99999-0000'), '(21) 99999-0000');
  assert.equal(formatar('5511988887777'), '(11) 98888-7777');
  assert.equal(formatar('123'), null);
  assert.equal(formatar(''), null);
});
