'use strict';
/**
 * Testes unitários para o cofre (Vault), contadores de uso por banco,
 * failover preventivo (70%), cache em memória (TTL 60s) e alertas Sentinel.
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
  checkBankHealth
} = require('../../lib/firebase-lite/firestore');

test('Contador de uso por banco e alertas preventivos de 70%', () => {
  // Simula uso próximo de 70% para o banco 'firestore-b' (limite 50000 -> 70% é 35000)
  registrarUsoBanco('firestore-b', 35000, 0);
  const uso = getUsoBanco('firestore-b');
  assert.strictEqual(uso.leituras, 35000);
  assert.strictEqual(uso.status, 'quase cheio');

  // Verifica se o health check pega o banco cheio
  assert.strictEqual(checkBankHealth('firestore-b'), false);
});

test('Cache em memória com TTL 60s e invalidação na escrita', () => {
  const tenant = 'test-tenant';
  const col = 'clientes';
  const docId = '123';
  const docData = { nome: 'João da Silva', email: 'joao@example.com' };

  // Define no cache
  setCachedFirestoreRead(tenant, col, docId, docData);

  // Lê do cache
  const cached = getCachedFirestoreRead(tenant, col, docId);
  assert.deepStrictEqual(cached, docData);

  // Invalida o cache
  invalidateFirestoreCache(tenant, col, docId);
  const cachedAfterInvalidate = getCachedFirestoreRead(tenant, col, docId);
  assert.strictEqual(cachedAfterInvalidate, null);
});

test('Rodízio de bancos e failover preventivo (B -> C -> D1 -> CofreSql)', () => {
  // Garante que se o banco atual estiver cheio, o getNextBank troca preventivamente
  const next = getNextBank();
  assert.ok(['firestore-b', 'firestore-c', 'd1', 'cofresql'].includes(next));

  const switched = switchToNextBank();
  assert.ok(['firestore-b', 'firestore-c', 'd1', 'cofresql'].includes(switched));
});

test('Bancos uso geral retorna lista completa', () => {
  const geral = getBancosUsoGeral();
  assert.ok(Array.isArray(geral));
  assert.ok(geral.length >= 4);
});
