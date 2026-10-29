'use strict';
// Modo lote: o design do site de referência também é salvo em clientes/<slug>/design.json (issue 4/5 de #2133).
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { caminhoDesignDoCliente } = require('../../scripts/clonar-site');

test('CS1. slug válido vira clientes/<slug>/design.json', () => {
  assert.strictEqual(caminhoDesignDoCliente('studio-lima', '/r'), path.join('/r', 'clientes', 'studio-lima', 'design.json'));
});

test('CS2. slug inválido ou vazio não grava nada (nunca sai de clientes/)', () => {
  for (const ruim of ['', undefined, 'ab', 'Maiuscula', '../x', 'a/b', 'a b', 'x'.repeat(41)]) {
    assert.strictEqual(caminhoDesignDoCliente(ruim, '/r'), null, String(ruim));
  }
});
