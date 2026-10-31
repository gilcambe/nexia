'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  Firestore,
  registrarUsoBanco,
  getUsoBanco,
  getBancosUsoGeral,
  getCachedFirestoreRead,
  setCachedFirestoreRead,
  invalidateFirestoreCache,
  getNextBank,
  switchToNextBank,
  checkBankHealth
} = require('../../lib/firebase-lite/firestore');

test('Firestore Lite - Contador de uso e limiar de 70%', async () => {
  // Limpar ou registrar uso específico
  registrarUsoBanco('firestore-b', 1000, 500);
  const uso = getUsoBanco('firestore-b');
  assert.strictEqual(uso.leituras, 1000);
  assert.strictEqual(uso.escritas, 500);
  assert.strictEqual(uso.status, 'ativo');

  // Testar listagem geral de uso
  const geral = getBancosUsoGeral();
  assert.ok(Array.isArray(geral));
  const b = geral.find(item => item.banco === 'firestore-b');
  assert.ok(b);
  assert.strictEqual(b.reads, 1000);
});

test('Firestore Lite - Cache em memória TTL 60s e invalidação', async () => {
  const tenantId = 'tenant-test';
  const collection = 'vault_docs';
  const docId = 'doc-123';
  const data = { name: 'Vault Test', value: 42 };

  setCachedFirestoreRead(tenantId, collection, docId, data);
  const cached = getCachedFirestoreRead(tenantId, collection, docId);
  assert.deepStrictEqual(cached, data);

  // Invalidação
  invalidateFirestoreCache(tenantId, collection, docId);
  const afterInvalidate = getCachedFirestoreRead(tenantId, collection, docId);
  assert.strictEqual(afterInvalidate, null);
});

test('Firestore Lite - Rodízio proativo de bancos', async () => {
  const banco1 = getNextBank();
  assert.ok(banco1);

  const bancoSeguinte = switchToNextBank();
  assert.ok(bancoSeguinte);
  assert.notStrictEqual(banco1, bancoSeguinte);
});
