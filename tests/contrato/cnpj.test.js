'use strict';
// Contrato: lib/cnpj.js — validação de CNPJ (dígitos verificadores) e formatação.
const test = require('node:test');
const assert = require('node:assert/strict');
const { valido, formatar } = require('../../lib/cnpj');
test('valido confere os dois dígitos verificadores', () => {
  assert.equal(valido('11.222.333/0001-81'), true);
  assert.equal(valido('11222333000181'), true);
  assert.equal(valido('11.222.333/0001-82'), false);
  assert.equal(valido('00.000.000/0000-00'), false);
  assert.equal(valido('1122233300018'), false);
  assert.equal(valido(''), false);
});
test('formatar põe a máscara; inválido devolve null', () => {
  assert.equal(formatar('11222333000181'), '11.222.333/0001-81');
  assert.equal(formatar('123'), null);
});
