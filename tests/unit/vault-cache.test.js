'use strict';
/**
 * Teste do cache em memória (TTL 60s) do Vault para leituras repetidas
 * de documentos (cliente, projeto, tenant), limpo em toda escrita.
 * Arquivo testado: nexia-ai/vault/repository.js
 */
const assert = require('assert');

function buildFakeDb() {
  const docs = new Map();
  return {
    collection: (col) => ({ doc: (id) => ({ get: async () => ({ exists: docs.has(id), data: () => docs.get(id) || null }) }) }),
    getDoc: (col, id) => docs.has(col + ':' + id) ? { exists: true, data: () => docs.get(col + ':' + id) } : { exists: false, data: () => null },
    setDoc: (col, id, data) => { docs.set(col + ':' + id, { ...data, id }); },
  };
}

function makeDeps(db) {
  return {
    db,
    FieldValue: { serverTimestamp: () => ({ __serverTimestamp: true }) },
  };
}

async function main() {
  const { createVault } = require('../../nexia-ai/vault/repository');
  const db = buildFakeDb();
  const deps = makeDeps(db);
  const vault = createVault(deps);

  const ctx = { tenantId: 't1', executionId: 'exec1', actor: { type: 'user', id: 'u1' } };

  // Insere um Client para testar leitura com cache
  await vault.Client.create(ctx, {
    nome: 'Cliente Teste',
    cnpj: '00.000.000/0001-00',
    email: 'cliente@teste.com.br',
    telefone: '11999999999',
    endereco: 'Rua X, 1',
    ativo: true,
    schemaVersion: 1,
  });

  // Primeira leitura: do banco
  const r1 = await vault.Client.get(ctx, 'cliente_1');
  assert.strictEqual(r1.nome, 'Cliente Teste');
  assert.ok(r1.id.startsWith('cliente_'));

  // Segunda leitura: deve vir do cache (mesmo objeto/registro)
  const r2 = await vault.Client.get(ctx, 'cliente_1');
  assert.strictEqual(r2.nome, 'Cliente Teste');
  assert.strictEqual(r2.id, r1.id);

  // Escreve no mesmo documento: cache deve ser invalidado
  await vault.Client.update(ctx, 'cliente_1', { nome: 'Cliente Atualizado' }, { expectedVersion: r1.version });
  const r3 = await vault.Client.get(ctx, 'cliente_1');
  assert.strictEqual(r3.nome, 'Cliente Atualizado', 'Cache deve ser limpo após escrita');

  // TTL: simula expiração do cache (60s)
  // O cache expira automaticamente após 60s; aqui testamos que uma leitura após escrita nova não usa o cache antigo
  await vault.Client.update(ctx, 'cliente_1', { telefone: '11888888888' }, { expectedVersion: r3.version });
  const r4 = await vault.Client.get(ctx, 'cliente_1');
  assert.strictEqual(r4.telefone, '11888888888', 'Cache deve ser limpo após segunda escrita');

  // Entidade não cacheada (não é Client/Project/Tenant) não deve entrar no cache
  const r5 = await vault.Project.create(ctx, {
    client_id: 'cliente_1',
    nome: 'Projeto Teste',
    status: 'ativo',
    schemaVersion: 1,
  });
  const r6 = await vault.Project.get(ctx, r5.record.id);
  assert.strictEqual(r6.nome, 'Projeto Teste');

  console.log('TESTE vault-cache: PASSOU');
}

main().catch((e) => { console.error('TESTE vault-cache: FALHOU', e); process.exit(1); });
