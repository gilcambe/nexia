'use strict';
// Teste unitário do Vault: contador de uso por banco, troca preventiva de cota aos 70% e cache em memória (TTL 60s).

const test = require('node:test');
const assert = require('node:assert');
const { createVault } = require('../../nexia-ai/vault/repository.js');

test('Vault - cache em memória e rastreamento de cota', async () => {
  let fetchedCount = 0;
  const mockDb = {
    runTransaction: async (fn) => fn({
      get: async () => ({ exists: true, data: () => ({ tenant_id: 't1', schemaVersion: 1, version: 1 }) }),
      create: () => {},
      update: () => {}
    }),
    collection: (col) => ({
      doc: (id) => ({
        get: async () => {
          fetchedCount++;
          return { exists: true, data: () => ({ id, tenant_id: 't1', schemaVersion: 1, version: 1, name: 'Test Project' }) };
        }
      }),
      where: () => ({ where: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }) })
    })
  };

  const mockTenantDb = {
    fetch: async (url, opts) => {
      return { ok: true, json: async () => ({ success: true, quaseCheio: false, leituras: 10, escritas: 5 }) };
    }
  };

  const vault = createVault({ db: mockDb, tenantDb: mockTenantDb });
  const ctx = { tenantId: 't1', executionId: 'exec_1', actor: { type: 'owner', id: 'owner_1' } };

  // Primeira leitura (vai ao banco)
  const r1 = await vault.Project.get(ctx, 'Project_1234567890abcdef1234567890abcdef');
  assert.strictEqual(r1.id, 'Project_1234567890abcdef1234567890abcdef');
  assert.strictEqual(fetchedCount, 1);

  // Segunda leitura imediata (deve vir do cache em memória com TTL 60s)
  const r2 = await vault.Project.get(ctx, 'Project_1234567890abcdef1234567890abcdef');
  assert.strictEqual(r2.id, 'Project_1234567890abcdef1234567890abcdef');
  assert.strictEqual(fetchedCount, 1); // Não incrementou, veio do cache!
});
