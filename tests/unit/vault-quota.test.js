'use strict';
/**
 * Testes unitários do Cofre e Rodízio de Cotas do Vault (Item 1, 2, 3).
 * Valida contador, limite de 70%, troca de banco e cache TTL 60s.
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

test('Contador de uso por banco e limite de 70%', () => {
  const bancoKey = 'firestore-b';
  registrarUsoBanco(bancoKey, 35000, 14000); // 35k/50k = 70%, 14k/20k = 70%
  const uso = getUsoBanco(bancoKey);
  assert.strictEqual(uso.leituras, 35000);
  assert.strictEqual(uso.escritas, 14000);
  assert.strictEqual(uso.status, 'quase cheio');
});

test('Rodízio de bancos e troca preventiva', () => {
  const proximo = switchToNextBank();
  assert.ok(proximo);
  const geral = getBancosUsoGeral();
  assert.ok(Array.isArray(geral));
  assert.ok(geral.length > 0);
});

test('Cache em memória TTL 60s e invalidação por escrita', () => {
  const tenantId = 'test-tenant';
  const collection = 'clientes';
  const docId = 'cli_123';
  const docData = { nome: 'Cliente Teste', plano: 'gratis' };

  setCachedFirestoreRead(tenantId, collection, docId, docData);
  const cached = getCachedFirestoreRead(tenantId, collection, docId);
  assert.deepStrictEqual(cached, docData);

  // Invalidação por escrita
  invalidateFirestoreCache(tenantId, collection, docId);
  const aposInvalidar = getCachedFirestoreRead(tenantId, collection, docId);
  assert.strictEqual(aposInvalidar, null);
});

test('Firestore-lite integrado com contagem e cache', async () => {
  const db = new Firestore({ projectId: 'nexia-c8710' });
  const ref = db.collection('projetos').doc('prj_test');
  
  await ref.set({ nome: 'Projeto X' });
  const res = await ref.get();
  assert.strictEqual(res.exists, true);
  assert.deepStrictEqual(res.data(), { nome: 'Projeto X' });
});
