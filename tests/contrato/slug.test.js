'use strict';
// Contrato: lib/slug.js — endereço do cliente (vira <slug>.kernex.com.br).
const test = require('node:test');
const assert = require('node:assert/strict');
const { slug } = require('../../lib/slug');
test('slug tira acento, espaço e símbolo; limita 40', () => {
  assert.equal(slug('Espaço Alegria'), 'espaco-alegria');
  assert.equal(slug('  Rota & Sol  Turismo!! '), 'rota-sol-turismo');
  assert.equal(slug('São João — Eventos'), 'sao-joao-eventos');
  assert.equal(slug('ÁÉÍÓÚ çãõ'), 'aeiou-cao');
  assert.equal(slug('a'.repeat(50)), 'a'.repeat(40));
  assert.equal(slug('x'.repeat(39) + ' y'), 'x'.repeat(39));
  assert.equal(slug('!!!'), '');
});
