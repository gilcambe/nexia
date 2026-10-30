'use strict';
const test = require('node:test');
const assert = require('node:assert');

test('Vault cota e cache unit tests', async (t) => {
  await t.test('Verifica se funções e rotinas de cota e cache estao presentes', () => {
    const fs = require('../../lib/firebase-lite/firestore.js');
    assert.ok(fs, 'Modulo firestore carregado com sucesso');
    assert.typeof(fs.registrarUsoFirestore, 'function');
    assert.typeof(fs.getUsoFirestore, 'function');
    assert.typeof(fs.getCachedFirestoreRead, 'function');
    assert.typeof(fs.setCachedFirestoreRead, 'function');
    assert.typeof(fs.invalidateFirestoreCache, 'function');
    assert.typeof(fs.getNextBank, 'function');
    assert.typeof(fs.switchToNextBank, 'function');
    assert.typeof(fs.checkBankHealth, 'function');
  });

  await t.test('Contador de uso por banco e alertas de 70%', () => {
    const fs = require('../../lib/firebase-lite/firestore.js');
    const bancoTest = 'banco-teste-' + Date.now();
    fs.registrarUsoFirestore(bancoTest, 35000, 0); // 35k leituras = 70% de 50k
    const uso = fs.getUsoFirestore(bancoTest);
    assert.equal(uso.leituras, 35000);
    assert.equal(fs.checkBankHealth(bancoTest), false);
  });

  await t.test('Cache em memória com TTL e invalidação', () => {
    const fs = require('../../lib/firebase-lite/firestore.js');
    const tenantId = 'tenant-1';
    const coll = 'projects';
    const docId = 'proj-1';
    const record = { fields: { name: { stringValue: 'Cortex Test' } } };

    fs.setCachedFirestoreRead(tenantId, coll, docId, record);
    const cached = fs.getCachedFirestoreRead(tenantId, coll, docId);
    assert.deepEqual(cached, record);

    fs.invalidateFirestoreCache(tenantId, coll, docId);
    const cachedAfterInvalidate = fs.getCachedFirestoreRead(tenantId, coll, docId);
    assert.equal(cachedAfterInvalidate, null);
  });
});
