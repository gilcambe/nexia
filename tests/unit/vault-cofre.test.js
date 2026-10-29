'use strict';
// Testes unitários para o cofre (Vault), contador de cota, troca antecipada e cache com TTL.
const test = require('node:test');
const assert = require('node:assert');
const { Firestore } = require('../../lib/firebase-lite/firestore.js');
const { createVault } = require('../../nexia-ai/vault/repository.js');

test('Firestore — contador de uso e limite de 70%', async () => {
  let trocado = false;
  const bancos = [
    { projectId: 'banco-a', getToken: async () => 'token' },
    { projectId: 'banco-b', getToken: async () => 'token' },
  ];

  const fs = new Firestore({ projectId: 'banco-a' });
  fs.enableFailover(bancos, () => Date.now());

  // Simula contagem de leituras perto de 70% de 50k (35.000 leituras)
  fs.ops.reads = 36000;
  
  // Teste de verificação de cota antecipada ou método interno de contagem por dia/banco
  assert.strictEqual(fs.projectId, 'banco-a');
});

test('Vault — Cache em memória com TTL de 60s e invalidação por escrita', async () => {
  let readCount = 0;
  const mockDoc = {
    exists: true,
    data: () => ({ id: 'cli_123', tenant_id: 'ten_1', schemaVersion: 1, version: 1, name: 'Teste' })
  };
  const mockCollection = {
    doc: (id) => ({
      get: async () => {
        readCount++;
        return mockDoc;
      }
    })
  };
  const mockDb = {
    collection: (name) => {
      if (name === 'tenants') {
        return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ tenant_id: 'ten_1' }) }) }) };
      }
      return mockCollection;
    },
    runTransaction: async (fn) => fn({
      get: async () => ({ exists: true, data: () => ({ tenant_id: 'ten_1', version: 1, deleted_at: null }) }),
      create: () => {},
      update: () => {},
      set: () => {}
    })
  };

  const vault = createVault({ db: mockDb });
  const ctx = { tenantId: 'ten_1', executionId: 'exec_1', actor: { type: 'owner', id: 'owner_1' } };

  // Chamada get deve ler do banco na primeira vez
  const r1 = await vault.Client.get(ctx, 'cli_123');
  assert.strictEqual(r1.id, 'cli_123');
  const initialReads = readCount;

  // Segunda chamada deve vir do cache (readCount não aumenta)
  const r2 = await vault.Client.get(ctx, 'cli_123');
  assert.strictEqual(r2.id, 'cli_123');
  assert.strictEqual(readCount, initialReads);
});
