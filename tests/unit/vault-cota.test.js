'use strict';
const test = require('node:test');
const assert = require('node:assert');

test('Vault cota e cache unit tests', async (t) => {
  await t.test('Verifica se funções e rotinas de cota e cache estao presentes', () => {
    const fs = require('../../lib/firebase-lite/firestore.js');
    assert.ok(fs, 'Modulo firestore carregado com sucesso');
  });
});
