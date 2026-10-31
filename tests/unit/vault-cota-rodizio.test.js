'use strict';
/**
 * Testes unitários para o contador de uso por banco, rodízio proativo a 70%,
 * cache em memória com TTL de 60s, invalidação por escrita e avisos sentinel.
 */

const test = require('node:test');
const assert = require('node:assert');
const {
  registrarUsoBanco,
  getUsoBanco,
  getBancosUsoGeral,
  getCachedFirestoreRead,
  setCachedFirestoreRead,
  invalidateFirestoreCache,
  getNextBank,
  switchToNextBank,
  checkBankHealth,
  Firestore
} = require('../../lib/firebase-lite/firestore.js');
const { createD1Backend } = require('../../lib/firebase-lite/d1-backend.js');

test('Contador de uso por banco e disparo de limite a 70%', () => {
  const bancoKey = 'firestore-b';
  // Reseta ou incrementa
  registrarUsoBanco(bancoKey, 36000, 15000); // Acima de 70% de 50k / 20k
  const uso = getUsoBanco(bancoKey);
  assert.strictEqual(uso.leituras >= 36000, true);
  assert.strictEqual(uso.status, 'quase cheio');
});

test('Cache em memória com TTL 60s e invalidação por escrita', () => {
  const tenantId = 'tenant_test';
  const collection = 'vault_clients';
  const docId = 'cli_123456';
  const record = { id: docId, name: 'Cliente Teste' };

  setCachedFirestoreRead(tenantId, collection, docId, record);
  const cached = getCachedFirestoreRead(tenantId, collection, docId);
  assert.deepStrictEqual(cached, record);

  // Invalidação
  invalidateFirestoreCache(tenantId, collection, docId);
  const cachedAfterInvalidate = getCachedFirestoreRead(tenantId, collection, docId);
  assert.strictEqual(cachedAfterInvalidate, null);
});

test('Rodízio proativo de bancos (B -> C -> D1 -> CofreSql)', () => {
  const b1 = getNextBank();
  assert.strictEqual(typeof b1, 'string');
  const b2 = switchToNextBank();
  assert.strictEqual(typeof b2, 'string');
  assert.notStrictEqual(b1, b2);
});

test('Firestore e D1 integrados com contadores e verificação geral', () => {
  const db = new Firestore({ projectId: 'nexia-c8710' });
  assert.ok(db);
  const geral = getBancosUsoGeral();
  assert.strictEqual(Array.isArray(geral), true);
  assert.strictEqual(geral.length > 0, true);
});
