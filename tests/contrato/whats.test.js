'use strict';
// Contrato: lib/whats.js — WhatsApp brasileiro para link wa.me.
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizar, link } = require('../../lib/whats');
test('normalizar devolve 55 + DDD + número, ou null', () => {
  assert.equal(normalizar('(11) 98888-7777'), '5511988887777');
  assert.equal(normalizar('11 3333-4444'), '551133334444');
  assert.equal(normalizar('+55 21 99999-0000'), '5521999990000');
  assert.equal(normalizar('5511988887777'), '5511988887777');
  assert.equal(normalizar('98888-7777'), null);
  assert.equal(normalizar(''), null);
  assert.equal(normalizar(null), null);
});
test('link monta wa.me com texto codificado', () => {
  assert.equal(link('(11) 98888-7777', 'Olá, tudo bem?'), 'https://wa.me/5511988887777?text=Ol%C3%A1%2C%20tudo%20bem%3F');
  assert.equal(link('(11) 98888-7777'), 'https://wa.me/5511988887777');
  assert.equal(link('123', 'x'), null);
});
