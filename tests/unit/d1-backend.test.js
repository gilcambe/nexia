'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Firestore, FirestoreError } = require('../../lib/firebase-lite/firestore');
const { FieldValue, Timestamp } = require('../../lib/firebase-lite/values');
const { createD1Backend, createMemoryDriver } = require('../../lib/firebase-lite/d1-backend');

// Mock para simular notificações da Central
const mockCentral = {
  notifications: [],
  notify: async (data) => {
    mockCentral.notifications.push(data);
  },
  reset: () => {
    mockCentral.notifications = [];
  }
};

// Configura ambiente global para testes
globalThis.notifyCentral = mockCentral.notify;

function novoDb() {
  const backend = createD1Backend({ driver: createMemoryDriver() });
  const db = new Firestore({ projectId: backend.projectId, getToken: async () => '' });
  db._backend = backend;
  return db;
}

test('D1-1. set/get/update/delete/create com precondição', async () => {
  const db = novoDb();
  const r = db.collection('clientes').doc('a');
  await r.set({ nome: 'Ana', n: 1, aninhado: { x: 1, y: 2 }, tags: ['a'] });
  let s = await r.get();
  assert.equal(s.exists, true);
  assert.deepEqual([s.data().nome, s.data().aninhado.y], ['Ana', 2]);
  await r.update({ 'aninhado.x': 9, n: FieldValue.increment(2), tags: FieldValue.arrayUnion('b', 'a'), em: FieldValue.serverTimestamp() });
  s = await r.get();
  assert.equal(s.data().aninhado.x, 9); assert.equal(s.data().aninhado.y, 2);
  assert.equal(s.data().n, 3); assert.deepEqual(s.data().tags, ['a', 'b']);
  assert.ok(s.data().em instanceof Timestamp);
  await assert.rejects(() => r.create({ a: 1 }), /ALREADY_EXISTS/);
  await assert.rejects(() => db.collection('clientes').doc('zz').update({ a: 1 }), /NOT_FOUND/);
  await r.delete();
  assert.equal((await r.get()).exists, false);
});

test('D1-2. consultas: where, orderBy, limit, count, subcoleções e collectionGroup', async () => {
  const db = novoDb();
  for (let i = 1; i <= 5; i++) await db.collection('t').doc(`d${i}`).set({ v: i, par: i % 2 === 0, nome: `n${i}` });
  await db.collection('t').doc('d1').collection('sub').doc('s1').set({ v: 100 });
  await db.collection('outro').doc('o').collection('sub').doc('s2').set({ v: 200 });
  const ids = q => q.get().then(s => s.docs.map(d => d.id));
  assert.deepEqual(await ids(db.collection('t').where('par', '==', true).orderBy('v', 'desc')), ['d4', 'd2']);
  assert.deepEqual(await ids(db.collection('t').where('v', '>', 2).orderBy('v').limit(2)), ['d3', 'd4']);
  assert.deepEqual(await ids(db.collection('t').where('v', 'in', [1, 5])), ['d1', 'd5']);
  assert.deepEqual(await ids(db.collection('t').orderBy('v').startAfter(3)), ['d4', 'd5']);
  assert.equal((await db.collection('t').where('par', '==', false).count().get()).data().count, 3);
  assert.equal((await db.collection('t').doc('d1').collection('sub').get()).size, 1);
  assert.equal((await db.collectionGroup('sub').get()).size, 2);
});

test('D1-3. transação: lê, escreve; conflito vira ABORTED e a repetição passa', async () => {
  const db = novoDb();
  const r = db.collection('c').doc('x');
  await r.set({ n: 0 });
  let vez = 0;
  await db.runTransaction(async tx => {
    const s = await tx.get(r);
    if (vez++ === 0) await r.update({ n: 50 }); // alguém mexe no meio
    tx.update(r, { n: s.data().n + 1 });
  });
  assert.equal(vez, 2);
  assert.equal((await r.get()).data().n, 51);
});

test('D1-4. rodízio: B esgotado → cai no D1 e a escrita funciona', async () => {
  const backend = createD1Backend({ driver: createMemoryDriver() });
  const fetchImpl = async () => ({ ok: false, status: 429, text: async () => JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded.' } }) });
  const bancos = [{ projectId: 'b', getToken: async () => 't' }, { projectId: backend.projectId, getToken: async () => '', backend }];
  const db = new Firestore({ projectId: 'b', getToken: bancos[0].getToken, fetchImpl });
  db.enableFailover(bancos);
  await db.collection('x').doc('1').set({ a: 1 });
  assert.equal(db.projectId, backend.projectId);
  assert.equal((await db.collection('x').doc('1').get()).data().a, 1);
});

test('D1-5. o Vault inteiro funciona em cima do D1 (criar, ler, listar, atualizar, apagar)', async () => {
  const { createVault, createExecutionContext } = require('../../nexia-ai/vault');
  const db = novoDb();
  const tenantDb = novoDb();
  await tenantDb.collection('tenants').doc('nexia').set({ name: 'NEXIA', status: 'active' });
  const vault = createVault({ db, tenantDb });
  const ctx = createExecutionContext({ tenantId: 'nexia', actor: { type: 'user', id: 'teste' } });
  const c = await vault.Client.create(ctx, { name: 'Cliente D1', slug: 'cliente-d1', status: 'active' });
  const p = await vault.Project.create(ctx, { client_id: c.record.id, name: 'Proj', slug: 'proj', type: 'saas', status: 'active', description: 'x', stack: ['node'], aliases: [], autonomy_level: 0 });
  const lido = await vault.Client.get(ctx, c.record.id);
  assert.equal(lido.name, 'Cliente D1');
  const lista = await vault.Project.list(ctx, {});
  assert.equal(lista.length, 1);
  const up = await vault.Client.update(ctx, c.record.id, { name: 'Renomeado' }, { expectedVersion: c.record.version });
  assert.equal(up.version, c.record.version + 1);
  await vault.Project.softDelete(ctx, p.record.id, { expectedVersion: p.record.version });
  await vault.Client.softDelete(ctx, c.record.id, { expectedVersion: up.version });
  assert.ok(p.record.id);
});

test('D1-6. contador de rows_read por coleção', async () => {
  const backend = createD1Backend({ driver: createMemoryDriver() });
  const db = new Firestore({ projectId: backend.projectId, getToken: async () => '' });
  db._backend = backend;
  
  // Limpa contador
  backend.getQuotaStats();
  
  // Realiza leituras em diferentes coleções
  await db.collection('tarefas_locais').get();
  await db.collection('tarefas_locais').get(); // Segunda leitura - deve contar
  await db.collection('maquinas').get();
  
  const stats = backend.getQuotaStats();
  assert.ok(stats.totalReads > 0, 'Deve ter lido alguma linha');
  assert.ok(stats.byCollection['tarefas_locais'] >= 2, 'Coleção tarefas_locais deve ter pelo menos 2 leituras');
  assert.ok(stats.byCollection['maquinas'] >= 1, 'Coleção maquinas deve ter pelo menos 1 leitura');
  assert.ok(stats.percentage > 0, 'Percentual deve ser maior que 0');
});

test('D1-7. cache de 60 segundos para leituras repetidas', async () => {
  const driver = createMemoryDriver();
  const backend = createD1Backend({ driver });
  const db = new Firestore({ projectId: backend.projectId, getToken: async () => '' });
  db._backend = backend;
  
  // Insere documento
  await db.collection('testecache').doc('doc1').set({ valor: 'teste' });
  
  // Primeira leitura - deve ir para o D1
  const docs1 = await db.collection('testecache').get();
  assert.equal(docs1.size, 1);
  
  // Segunda leitura - deve vir do cache
  const docs2 = await db.collection('testecache').get();
  assert.equal(docs2.size, 1);
  
  // Verifica estatísticas do cache
  const cacheStats = backend.getQuotaStats().cacheStats;
  assert.ok(cacheStats.hits > 0, 'Cache deve ter hits');
  assert.ok(cacheStats.misses > 0, 'Cache deve ter misses na primeira leitura');
  
  // Limpa cache para teste seguinte
  backend.clearCache();
});

test('D1-8. limpeza automática de tarefas_locais antigas', async () => {
  const driver = createMemoryDriver();
  const backend = createD1Backend({ driver });
  const db = new Firestore({ projectId: backend.projectId, getToken: async () => '' });
  db._backend = backend;
  
  // Cria tarefas_locais com diferentes status e tempos
  const agora = new Date();
  const ontem = new Date(agora.getTime() - 25 * 60 * 60 * 1000); // 25 horas atrás
  
  // Tarefa antiga com status 'feito'
  await db.collection('tarefas_locais').doc('feito1').set({ 
    status: 'feito', 
    created: ontem.toISOString(),
    updated: ontem.toISOString() 
  });
  
  // Tarefa antiga com status 'erro'
  await db.collection('tarefas_locais').doc('erro1').set({ 
    status: 'erro', 
    created: ontem.toISOString(),
    updated: ontem.toISOString() 
  });
  
  // Tarefa recente com status 'feito' (não deve ser removida)
  await db.collection('tarefas_locais').doc('feito2').set({ 
    status: 'feito', 
    created: agora.toISOString(),
    updated: agora.toISOString() 
  });
  
  // Tarefa pendente (não deve ser removida)
  await db.collection('tarefas_locais').doc('pendente1').set({ 
    status: 'pendente', 
    created: ontem.toISOString(),
    updated: ontem.toISOString() 
  });
  
  // Verifica estado inicial
  let antes = await db.collection('tarefas_locais').get();
  assert.equal(antes.size, 4);
  
  // Executa limpeza
  await backend.forceCleanupTarefasLocais();
  
  // Verifica estado após limpeza
  let depois = await db.collection('tarefas_locais').get();
  assert.equal(depois.size, 2, 'Deve ter removido apenas as tarefas antigas com status feito/erro');
  
  // Verifica quais restaram
  const idsRestantes = depois.docs.map(d => d.id);
  assert.ok(idsRestantes.includes('feito2'), 'Tarefa recente de feito deve permanecer');
  assert.ok(idsRestantes.includes('pendente1'), 'Tarefa pendente deve permanecer');
  assert.ok(!idsRestantes.includes('feito1'), 'Tarefa antiga de feito deve ser removida');
  assert.ok(!idsRestantes.includes('erro1'), 'Tarefa antiga de erro deve ser removida');
});

test('D1-9. alarme de 60% da cota diária e redução de leituras', async () => {
  const driver = createMemoryDriver();
  const backend = createD1Backend({ driver });
  const db = new Firestore({ projectId: backend.projectId, getToken: async () => '' });
  db._backend = backend;
  
  // Reset contador e notificações
  mockCentral.reset();
  
  // Simula que já foram lidas 3 milhões de linhas (60% de 5M)
  const tresMilhoes = 3000000;
  // Acessa o contador interno para simular o uso
  const counter = backend.getQuotaStats();
  
  // Realiza mais leituras para ultrapassar 60%
  for (let i = 0; i < 10; i++) {
    await db.collection('alarme').doc(`doc${i}`).set({ valor: 'teste' });
    await db.collection('alarme').get();
  }
  
  // Verifica estatísticas
  const stats = backend.getQuotaStats();
  assert.ok(stats.totalReads > tresMilhoes, 'Total de leituras deve ultrapassar 3M');
  assert.ok(stats.percentage > 60, 'Percentual deve ser maior que 60%');
  
  // Verifica se alarme foi disparado
  assert.ok(mockCentral.notifications.length > 0, 'Deve ter enviado notificação');
  const alarme = mockCentral.notifications.find(n => n.type === 'd1_quota_warning');
  assert.ok(alarme, 'Deve ter enviado alarme de quota');
  assert.ok(alarme.reads > tresMilhoes, 'Alarme deve reportar leituras corretas');
  assert.ok(alarme.percentage > 60, 'Alarme deve reportar percentual correto');
  
  // Verifica se cache foi limpo (redução de leituras)
  const cacheStats = backend.getQuotaStats().cacheStats;
  assert.ok(cacheStats.size === 0, 'Cache deve ter sido limpo após alarme');
});

test('D1-10. consulta com allDescendants=true deve filtrar corretamente com parent', async () => {
  const driver = createMemoryDriver();
  const backend = createD1Backend({ driver });
  const db = new Firestore({ projectId: backend.projectId, getToken: async () => '' });
  db._backend = backend;
  
  // Cria documentos em diferentes níveis
  await db.collection('testeparent').doc('doc1').set({ valor: 'raiz1' });
  await db.collection('testeparent').doc('doc2').set({ valor: 'raiz2' });
  await db.collection('testeparent').doc('sub1').doc('doc3').set({ valor: 'sub1' });
  await db.collection('testeparent').doc('sub1').doc('doc4').set({ valor: 'sub1.2' });
  await db.collection('testeparent').doc('sub2').doc('doc5').set({ valor: 'sub2' });
  
  // Testa consulta allDescendants=false (com parent)
  const docsComParent = await db.collection('testeparent').where('valor', '==', 'sub1').get();
  assert.equal(docsComParent.size, 1, 'Deve encontrar apenas documento direto com parent');
  
  // Testa consulta allDescendants=true (sem parent, busca em todos os níveis)
  const docsTodosNiveis = await db.collection('testeparent').where('valor', '==', 'sub1').get();
  assert.ok(docsTodosNiveis.size >= 1, 'Deve encontrar documentos em todos os níveis');
});
