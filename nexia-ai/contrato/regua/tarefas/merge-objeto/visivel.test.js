'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { mesclarObjetos } = require('./solucao');

test('merge básico de objetos com Object.assign', () => {
  const base = { a: 1, b: 2 };
  const sobrescrita = { b: 3, c: 4 };
  const resultado = mesclarObjetos(base, sobrescrita);

  assert.strictEqual(resultado.a, 1);
  assert.strictEqual(resultado.b, 3);
  assert.strictEqual(resultado.c, 4);
});
