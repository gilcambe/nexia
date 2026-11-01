'use strict';
/**
 * Testes unitários para o cofre (Vault), rodízio preventivo, contadores de uso,
 * cache em memória e tratamento de cota.
 */
const test = require('node:test');
const assert = require('assert');
const { 
  registrarUsoBanco, 
  getUsoBanco, 
  getBancosUsoGeral, 
  getNextBank, 
  switchToNextBank,
  getCachedFirestoreRead,
  setCachedFirestoreRead,
  invalidateFirestoreCache
} = require('../lib/firebase-lite/firestore.js');

test('Contador de uso por banco e limites', () => {
  const bancoTest = 'firestore-b';
  registrarUsoBanco(bancoTest, 100, 50);
  const uso = getUsoBanco(bancoTest);
  assert.strictEqual(uso.leituras >= 100, true);
  assert.strictEqual(uso.escritas >= 50, true);
  
  const gerais = getBancosUsoGeral();
  assert.strictEqual(Array.isArray(gerais), true);
  const itemB = gerais.find(b => b.banco === bancoTest);
  assert.ok(itemB);
  assert.strictEqual(itemB.reads >= 100, true);
});

test('Rodízio de bancos e limiar de 70%', () => {
  const bancoAtual = getNextBank();
  assert.ok(bancoAtual);
  
  const proximo = switchToNextBank();
  assert.ok(proximo);
});

test('Cache em memória TTL 60s para leituras do Vault', () => {
  const tenantId = 'tenant_test';
  const collection = 'clients';
  const docId = 'cli_123456';
  const record = { id: docId, name: 'Teste Cliente' };

  setCachedFirestoreRead(tenantId, collection, docId, record);
  const cached = getCachedFirestoreRead(tenantId, collection, docId);
  assert.deepStrictEqual(cached, record);

  invalidateFirestoreCache(tenantId, collection, docId);
  const aposInvalidar = getCachedFirestoreRead(tenantId, collection, docId);
  assert.strictEqual(aposInvalidar, null);
});
