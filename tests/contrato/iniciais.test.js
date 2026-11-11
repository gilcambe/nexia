'use strict';
// Contrato de prova do degrau PC2 (11/11/2026): lib/iniciais.js devolve as iniciais de um nome.
const test = require('node:test');
const assert = require('node:assert/strict');
const { iniciais } = require('../../lib/iniciais');
test('iniciais de um nome', () => {
  assert.equal(iniciais('Studio Lima'), 'SL');
  assert.equal(iniciais('ana maria da silva'), 'AM');
  assert.equal(iniciais('  João  '), 'J');
  assert.equal(iniciais(''), '');
});
