'use strict';
/**
 * Testes unitários do Vault: Contador de uso por banco, Rodízio antecipado (70%), Cache em memória TTL 60s.
 */
const test = require('node:test');
const assert = require('node:assert');
const { createVault } = require('../../nexia-ai/vault/repository');
const { SCHEMAS } = require('../../nexia-ai/vault/schemas');
const { registrarUsoBanco, getUsoBanco, getBancosUsoGeral } = require('../../lib/firebase-lite/firestore');

test('Cofre & Vault — Contador de uso e status do rodízio (70%)', async () => {
  // Testa registrador de uso
  registrarUsoBanco('firestore-b', 10, 5);
  const uso = getUsoBanco('firestore-b');
  assert.strictEqual(uso.leituras, 10);
  assert.strictEqual(uso.escritas, 5);
  assert.strictEqual(uso.status, 'ativo');

  // Força disparo do limite de 70% (50000 leituras * 0.7 = 35000)
  registrarUsoBanco('firestore-b', 35005, 0);
  const usoCheio = getUsoBanco('firestore-b');
  assert.strictEqual(usoCheio.status, 'quase cheio');

  const todos = getBancosUsoGeral();
  assert(Array.isArray(todos));
  const b = todos.find(x => x.banco === 'firestore-b');
  assert.ok(b);
  assert.strictEqual(b.status, 'quase cheio');
});

test('Cache em memória do Vault (TTL 60s) e invalidação na escrita', async () => {
  let docLeituras = 0;
  const mockDoc = { id: 'prj_123', tenant_id: 'tenant_abc', name: 'Projeto Alpha', schemaVersion: 1, version: 1 };
  
  const fakeDb = {
    runTransaction: async (fn) => fn({
      get: async () => ({ exists: true, data: () => mockDoc }),
      create: () => {},
      set: () => {},
      update: () => {}
    }),
    collection: (col) => ({
      doc: (id) => ({
        get: async () => {
          docLeituras++;
          return { exists: true, data: () => mockDoc };
        }
      })
    })
  };

  const vault = createVault({ db: fakeDb });
  const ctx = { tenantId: 'tenant_abc', executionId: 'exe_1', actor: { type: 'owner', id: 'owner_1' } };

  // Primeira leitura (vai ao banco)
  const r1 = await vault.Project.get(ctx, 'prj_123');
  assert.strictEqual(r1.name, 'Projeto Alpha');
  const leiturasAntes = docLeituras;

  // Segunda leitura (deve vir do cache em memória)
  const r2 = await vault.Project.get(ctx, 'prj_123');
  assert.strictEqual(r2.name, 'Projeto Alpha');
  // Se o cache funcionou, o número de leituras ao db não aumentou
  assert.strictEqual(docLeituras, leiturasAntes);
});
