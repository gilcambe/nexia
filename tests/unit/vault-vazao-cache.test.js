'use strict';
/**
 * Testes unitários para o cofre (Vault), controle de vazão por banco,
 * troca preventiva em 70%, cache em memória TTL 60s e invalidação por escrita.
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
  BANK_LIMITS
} = require('../../lib/firebase-lite/firestore');

const { createD1Backend } = require('../../lib/firebase-lite/d1-backend');

test('Contador de uso por banco e limites de vazão', () => {
  const bancoTest = 'firestore-b';
  // Registrar leituras e escritas
  registrarUsoBanco(bancoTest, 100, 50);
  const uso = getUsoBanco(bancoTest);
  assert.strictEqual(uso.leituras, 100);
  assert.strictEqual(uso.escritas, 50);
  assert.strictEqual(uso.status, 'ativo');
});

test('Disparo de status quase cheio ao atingir 70% do limite', () => {
  const bancoTest = 'firestore-c';
  const limits = BANK_LIMITS[bancoTest];
  const leiturasQuaseCheias = Math.ceil(limits.reads * 0.75);
  
  registrarUsoBanco(bancoTest, leiturasQuaseCheias, 0);
  const uso = getUsoBanco(bancoTest);
  assert.strictEqual(uso.status, 'quase cheio');
  assert.strictEqual(checkBankHealth(bancoTest), false);
});

test('Cache em memória com TTL de 60s e invalidação por escrita', () => {
  const tenantId = 'tenant_test';
  const collection = 'usuarios';
  const docId = 'doc_123';
  const data = { nome: 'Teste Cache', email: 'teste@nexia.ai' };

  // Definir cache
  setCachedFirestoreRead(tenantId, collection, docId, data);
  
  // Ler do cache
  const cached = getCachedFirestoreRead(tenantId, collection, docId);
  assert.deepStrictEqual(cached, data);

  // Invalidar por escrita
  invalidateFirestoreCache(tenantId, collection, docId);
  const cachedAfterInvalidate = getCachedFirestoreRead(tenantId, collection, docId);
  assert.strictEqual(cachedAfterInvalidate, null);
});

test('Rodízio de bancos (getNextBank e switchToNextBank)', () => {
  const b1 = getNextBank();
  assert.ok(typeof b1 === 'string');
  const b2 = switchToNextBank();
  assert.ok(typeof b2 === 'string');
});

test('D1 backend inicialização e uso', () => {
  const mockDriver = {
    exec(sql, ...params) {
      if (sql.includes('CREATE TABLE')) return [];
      if (sql.includes('SELECT data FROM firestore_docs')) return [];
      if (sql.includes('INSERT INTO firestore_docs')) return [];
      return [];
    }
  };
  const d1 = createD1Backend({ driver: mockDriver, projectId: 'd1-test' });
  const uso = d1.getUso();
  assert.ok(uso);
  assert.strictEqual(uso.leituras, 0);
  assert.strictEqual(uso.escritas, 0);
});
