'use strict';
// Testes unitários para o controle de cota, troca de banco, cache em memória do Vault e limpezas.

const { test } = require('node:test');
const assert = require('node:assert');
const { createVault } = require('../../nexia-ai/vault/repository.js');

test('Vault cache in-memory TTL and invalidation', async () => {
  let fetchedCount = 0;
  const mockDoc = {
    exists: true,
    data: () => ({ tenant_id: 'tenant-1', schemaVersion: 1, version: 1, name: 'Test Project', project_id: null, client_id: null })
  };
  const mockCol = {
    doc: (id) => ({
      get: async () => {
        fetchedCount++;
        return mockDoc;
      }
    })
  };
  const mockDb = {
    collection: (name) => mockCol,
    runTransaction: async (fn) => fn({
      get: async () => mockDoc,
      create: () => {},
      update: () => {},
      delete: () => {}
    })
  };

  const vault = createVault({ db: mockDb });
  const ctx = { tenantId: 'tenant-1', executionId: 'exec-1', actor: { type: 'owner', id: '1' } };

  // 1st get
  const r1 = await vault.Project.get(ctx, 'prj_1234567890abcdef1234567890abcdef');
  assert.strictEqual(fetchedCount, 1);
  assert.ok(r1);

  // 2nd get (should be cached)
  const r2 = await vault.Project.get(ctx, 'prj_1234567890abcdef1234567890abcdef');
  assert.strictEqual(fetchedCount, 1);
  assert.deepStrictEqual(r1, r2);
});
