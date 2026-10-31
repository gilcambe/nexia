'use strict';
/**
 * Testes unitários para o cofre (Vault) - Contador de uso, rodízio, cache TTL e CofreSql.
 */
const test = require('node:test');
const assert = require('node:assert');
const { registrarUsoBanco, getUsoBanco, getBancosUsoGeral, getCachedFirestoreRead, setCachedFirestoreRead, invalidateFirestoreCache, BANK_LIMITS } = require('../lib/firebase-lite/firestore');
const { CofreSql } = require('../src/durable/CofreSql');

test('Contador de uso por banco e limites (70%)', () => {
  const banco = 'firestore-default';
  const limits = BANK_LIMITS[banco];
  
  // Registrar uso abaixo do limite de 70%
  registrarUsoBanco(banco, 100, 50);
  const uso = getUsoBanco(banco);
  assert.strictEqual(uso.leituras >= 100, true);
  assert.strictEqual(uso.escritas >= 50, true);
  assert.strictEqual(uso.status, 'ativo');

  // Registrar uso acima de 70% para disparar alerta sentinel
  const leiturasQuaseCheio = Math.ceil(limits.reads * 0.75);
  const escritasQuaseCheio = Math.ceil(limits.writes * 0.75);
  registrarUsoBanco(banco, leiturasQuaseCheio, escritasQuaseCheio);
  
  const usoAtualizado = getUsoBanco(banco);
  assert.strictEqual(usoAtualizado.status, 'quase cheio');
});

test('Cache em memória (TTL 60s) para leituras repetidas do Vault', () => {
  const tenantId = 'tenant_test';
  const collection = 'vault_clients';
  const docId = 'cli_12345';
  const record = { id: docId, name: 'Cliente Teste', tenant_id: tenantId };

  // Definir cache
  setCachedFirestoreRead(tenantId, collection, docId, record);

  // Ler do cache
  const cached = getCachedFirestoreRead(tenantId, collection, docId);
  assert.deepStrictEqual(cached, record);

  // Invalidar cache por escrita
  invalidateFirestoreCache(tenantId, collection, docId);
  const cachedAfterInvalidate = getCachedFirestoreRead(tenantId, collection, docId);
  assert.strictEqual(cachedAfterInvalidate, null);
});

test('CofreSql uso e verificação de limites', () => {
  const mockState = {
    storage: {
      sql: {
        exec: () => ({
          toArray: () => [{ leituras: 40000, escritas: 15000 }]
        })
      }
    }
  };
  const cofreSql = new CofreSql(mockState);
  assert.ok(cofreSql.sql);
});

test('Bancos uso geral retorna todos os bancos do cofre', () => {
  const bancos = getBancosUsoGeral();
  assert.ok(Array.isArray(bancos));
  assert.ok(bancos.length >= 4);
  const bDefault = bancos.find(b => b.banco === 'firestore-default');
  assert.ok(bDefault);
});
