'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createMemoryDriver, createD1Backend } = require('../../lib/firebase-lite/d1-backend');
const { Firestore } = require('../../lib/firebase-lite/firestore');
const cortexMemory = require('../../netlify/functions/cortex-memory');
const usageModule = require('../../netlify/functions/usage');

function createTestD1Db() {
  const driver = createMemoryDriver();
  const backend = createD1Backend({ driver });
  const db = new Firestore({ projectId: backend.projectId, getToken: async () => '' });
  db._backend = backend;
  return { db, driver, backend };
}

test('Q6-1. Isolamento por UID/Tenant no D1 para memória de conversas e contador de uso', async () => {
  const { db } = createTestD1Db();
  const opts = { db };

  // Usuário A (tenant-alpha, uid-1) e Usuário B (tenant-alpha, uid-2)
  const userA = 'uid-1';
  const userB = 'uid-2';
  const tenant = 'tenant-alpha';

  // Salva memória e uso para o Usuário A
  await cortexMemory.save(userA, [{ role: 'user', content: 'Mensagem do Usuário A' }], [], tenant, {}, 'conv-1', opts);

  // Carrega memória para Usuário A e Usuário B
  const memA = await cortexMemory.load(userA, tenant, 'conv-1', opts);
  const memB = await cortexMemory.load(userB, tenant, 'conv-1', opts);

  assert.equal(memA.history.length, 1);
  assert.equal(memA.history[0].content, 'Mensagem do Usuário A');
  assert.equal(memB.history.length, 0, 'Usuário B não deve ver o histórico do Usuário A');

  // Limpa a memória de Usuário A
  await cortexMemory.clear(userA, tenant, 'conv-1', opts);
  const memAAfter = await cortexMemory.load(userA, tenant, 'conv-1', opts);
  assert.equal(memAAfter.history.length, 0);

  // Teste de consulta e limite de uso via usageModule com D1
  const limitCheck = await usageModule.checkLimit(tenant, userA, 'cortex', opts);
  assert.equal(limitCheck.ok, true);

  const stats = await usageModule.getUsageStats(tenant, 7, opts);
  assert.equal(stats.tenantId, tenant);
});

test('Q6-2. Teste de carga Q1: 1000 pessoas interagindo com conversas e uso no D1', async () => {
  const { db } = createTestD1Db();
  const opts = { db };
  const numPessoas = 1000;
  const tenant = 'tenant-simulacao';

  db.ops.reads = 0;
  db.ops.writes = 0;

  // 1000 pessoas realizam 1 ciclo completo: carregar memória, salvar mensagem ao fim da resposta e registrar uso
  for (let i = 0; i < numPessoas; i++) {
    const uid = `user_${i}`;
    const convId = `conv_${i}`;

    // 1. Carrega histórico existente
    const mem = await cortexMemory.load(uid, tenant, convId, opts);

    // 2. Grava histórico com a nova mensagem no fim da resposta (em lote)
    const newHistory = [...mem.history, { role: 'user', content: `Pergunta do usuário ${i}` }, { role: 'assistant', content: `Resposta para ${i}` }];
    await cortexMemory.save(uid, newHistory, mem.summaries, tenant, {}, convId, opts);

    // 3. Atualiza contador de uso no D1
    const today = new Date().toISOString().split('T')[0];
    const usageRef = db.collection('tenants').doc(tenant).collection('usage').doc(today);
    const doc = await usageRef.get();
    if (!doc.exists) {
      await usageRef.set({ date: today, cortexCalls: 1, tenantId: tenant, plan: 'free' });
    } else {
      await usageRef.update({ cortexCalls: (doc.data().cortexCalls || 0) + 1 });
    }
  }

  const totalLeituras = db.ops.reads;
  const totalEscritas = db.ops.writes;

  // Cotas grátis do Cloudflare D1: 5.000.000 leituras/dia e 100.000 gravações/dia
  const LIMITE_D1_LEITURAS_DIA = 5000000;
  const LIMITE_D1_GRAVACOES_DIA = 100000;

  assert.ok(totalEscritas < LIMITE_D1_GRAVACOES_DIA, `Gravações (${totalEscritas}) devem estar dentro da cota grátis do D1 (${LIMITE_D1_GRAVACOES_DIA})`);
  assert.ok(totalLeituras < LIMITE_D1_LEITURAS_DIA, `Leituras (${totalLeituras}) devem estar dentro da cota grátis do D1 (${LIMITE_D1_LEITURAS_DIA})`);

  // Confirma a integridade dos dados para amostras de usuários
  const sampleMem = await cortexMemory.load('user_500', tenant, 'conv_500', opts);
  assert.equal(sampleMem.history.length, 2);
  assert.equal(sampleMem.history[0].content, 'Pergunta do usuário 500');
  assert.equal(sampleMem.history[1].content, 'Resposta para 500');
});
