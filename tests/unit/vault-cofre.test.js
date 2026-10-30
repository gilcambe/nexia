'use strict';
const assert = require('node:assert');
const test = require('node:test');
const {
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

test('Cofre Vault - Contador de uso por banco e limites (70%)', () => {
  const banco = 'firestore-b';
  // Simula uso abaixo do limite
  registrarUsoBanco(banco, 10, 5);
  const uso = getUsoBanco(banco);
  assert.strictEqual(uso.leituras, 10);
  assert.strictEqual(uso.escritas, 5);
  assert.strictEqual(uso.status, 'ativo');

  // Simula atingir 70% do limite (50000 * 0.7 = 35000)
  registrarUsoBanco(banco, 35000, 15000);
  const usoCheio = getUsoBanco(banco);
  assert.strictEqual(usoCheio.status, 'quase cheio');

  const geral = getBancosUsoGeral();
  assert.ok(Array.isArray(geral));
  const b = geral.find(item => item.banco === banco);
  assert.ok(b);
  assert.strictEqual(b.status, 'quase cheio');
});

test('Cofre Vault - Cache em memória (TTL 60s) e invalidação', () => {
  const tenantId = 'tenant-test';
  const collection = 'vault_docs';
  const docId = 'doc-1';
  const record = { id: docId, valor: 'segredo' };

  // Inicialmente vazio
  assert.strictEqual(getCachedFirestoreRead(tenantId, collection, docId), null);

  // Seta no cache
  setCachedFirestoreRead(tenantId, collection, docId, record);
  const cached = getCachedFirestoreRead(tenantId, collection, docId);
  assert.deepStrictEqual(cached, record);

  // Invalida cache
  invalidateFirestoreCache(tenantId, collection, docId);
  assert.strictEqual(getCachedFirestoreRead(tenantId, collection, docId), null);
});

test('Cofre Vault - Rodízio e troca de bancos (B -> C -> D1 -> CofreSql)', () => {
  const b1 = getNextBank();
  assert.ok(['firestore-b', 'firestore-c', 'd1', 'cofresql'].includes(b1));

  const proximo = switchToNextBank();
  assert.ok(proximo);
});
