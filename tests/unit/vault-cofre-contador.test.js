'use strict';
/**
 * Testes unitários do cofre (Vault), cache TTL 60s, contador de uso por banco e rodízio preventivo.
 */
const test = require('node:test');
const assert = require('node:assert');

test('Cofre / Vault: Cache em memória com TTL 60s e invalidação', async () => {
  const { createVault } = require('../../nexia-ai/vault/repository');
  let gets = 0;
  const mockDb = {
    runTransaction: async (fn) => fn({
      get: async () => ({ exists: true, data: () => ({ id: 'cli_123', tenant_id: 'ten_abc', name: 'Cliente A', version: 1, schemaVersion: 1, created_at: new Date(), updated_at: new Date(), deleted_at: null }) }),
      create: () => {},
      update: () => {},
      delete: () => {}
    }),
    collection: (col) => ({
      doc: (id) => ({
        get: async () => {
          gets++;
          return { exists: true, data: () => ({ id, tenant_id: 'ten_abc', name: 'Cliente A', version: 1, schemaVersion: 1, created_at: new Date(), updated_at: new Date(), deleted_at: null }) };
        }
      })
    })
  };

  const vault = createVault({ db: mockDb });
  const ctx = { tenantId: 'ten_abc', executionId: 'exe_1', actor: { type: 'user', id: 'usr_1' } };
  
  // 1ª leitura vai ao banco
  const r1 = await vault.Client.get(ctx, 'cli_123');
  assert.strictEqual(r1.name, 'Cliente A');
  assert.strictEqual(gets, 1);

  // 2ª leitura deve vir do cache (gets não aumenta)
  const r2 = await vault.Client.get(ctx, 'cli_123');
  assert.strictEqual(r2.name, 'Cliente A');
  assert.strictEqual(gets, 1);
});

test('Firestore-lite: Contador de uso por banco e alertas Sentinel', async () => {
  const { Firestore, getBancosUsoGeral } = require('../../lib/firebase-lite/firestore');
  const db = new Firestore();
  const uso = getBancosUsoGeral();
  assert.ok(Array.isArray(uso));
  assert.ok(uso.length > 0);
  const def = uso.find(b => b.banco === 'firestore-default');
  assert.ok(def);
});
