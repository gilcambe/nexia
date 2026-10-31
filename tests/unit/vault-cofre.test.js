'use strict';
/**
 * Testes unitários para o cofre (Vault) - Contador de uso, Cache TTL 60s, Rodízio proativo e Central.
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
  switchToNextBank,
  checkBankHealth
} = require('./lib/firebase-lite/firestore.js');

test('Cofre Vault - Contador de uso e Limites (70%)', () => {
  const banco = 'firestore-b';
  registrarUsoBanco(banco, 100, 50);
  const uso = getUsoBanco(banco);
  assert.strictEqual(uso.leituras, 100);
  assert.strictEqual(uso.escritas, 50);
  assert.strictEqual(uso.status, 'ativo');

  // Simular ultrapassar 70% (limite reads = 50000, 70% = 35000)
  registrarUsoBanco(banco, 35000, 0);
  const usoQuaseCheio = getUsoBanco(banco);
  assert.strictEqual(usoQuaseCheio.status, 'quase cheio');
});

test('Cofre Vault - Cache em memória (TTL 60s e invalidação)', () => {
  const tenant = 'tenant-teste';
  const coll = 'clientes';
  const docId = 'cli_123';
  const dados = { nome: 'Empresa Teste', plano: 'gratis' };

  setCachedFirestoreRead(tenant, coll, docId, dados);
  const cached = getCachedFirestoreRead(tenant, coll, docId);
  assert.deepStrictEqual(cached, dados);

  // Invalidação por escrita/docId
  invalidateFirestoreCache(tenant, coll, docId);
  const cachedAposInval = getCachedFirestoreRead(tenant, coll, docId);
  assert.strictEqual(cachedAposInval, null);
});

test('Cofre Vault - Rodízio proativo entre bancos (B -> C -> D1 -> CofreSql)', () => {
  const b1 = getNextBank();
  assert.ok(typeof b1 === 'string');

  const b2 = switchToNextBank();
  assert.ok(typeof b2 === 'string');
  assert.notStrictEqual(b1, b2);

  const geral = getBancosUsoGeral();
  assert.ok(Array.isArray(geral));
  assert.ok(geral.length >= 4);
});
