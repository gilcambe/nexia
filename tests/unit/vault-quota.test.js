'use strict';
/**
 * Testes unitários para cota, rodízio preventivo de 70% e cache em memória (TTL 60s) do Vault.
 */
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
  switchToNextBank
} = require('../../lib/firebase-lite/firestore.js');

test('Vault - Contador de uso e limite de 70%', async () => {
  const bancoTest = 'firestore-b';
  registrarUsoBanco(bancoTest, 36000, 15000); // 36k / 50k = 72% leituras, 15k / 20k = 75% escritas
  const uso = getUsoBanco(bancoTest);
  assert.strictEqual(uso.status, 'quase cheio');
  assert.strictEqual(uso.leituras, 36000);
  assert.strictEqual(uso.escritas, 15000);
});

test('Vault - Rodízio preventivo e troca de banco', async () => {
  const next = getNextBank();
  assert.ok(typeof next === 'string');
  const switched = switchToNextBank();
  assert.ok(typeof switched === 'string');
});

test('Vault - Cache em memória com TTL de 60s e invalidação', async () => {
  const tenantId = 'test-tenant';
  const collection = 'clientes';
  const docId = 'cli_123';
  const docData = { nome: 'Cliente Teste', ativo: true };

  // Inicialmente vazio
  assert.strictEqual(getCachedFirestoreRead(tenantId, collection, docId), null);

  // Grava no cache
  setCachedFirestoreRead(tenantId, collection, docId, docData);
  const cached = getCachedFirestoreRead(tenantId, collection, docId);
  assert.deepStrictEqual(cached, docData);

  // Invalida cache
  invalidateFirestoreCache(tenantId, collection, docId);
  assert.strictEqual(getCachedFirestoreRead(tenantId, collection, docId), null);
});

test('Vault - Listagem geral de uso dos bancos do cofre', async () => {
  const geral = getBancosUsoGeral();
  assert.ok(Array.isArray(geral));
  assert.ok(geral.length >= 4);
  const b = geral.find(item => item.banco === 'firestore-b');
  assert.ok(b);
  assert.ok('reads' in b);
  assert.ok('writes' in b);
  assert.ok('status' in b);
});
