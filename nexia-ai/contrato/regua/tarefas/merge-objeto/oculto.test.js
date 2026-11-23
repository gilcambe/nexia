'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { mesclarObjetos } = require('./solucao');

test('preservação de chaves originais e tratamento de objetos vazios', () => {
  const base = { x: 10, y: 20 };
  const resultado = mesclarObjetos(base, {});

  assert.strictEqual(resultado.x, 10);
  assert.strictEqual(resultado.y, 20);
  assert.notStrictEqual(resultado, base); // Deve retornar um novo objeto
});
