'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Firestore, FirestoreError } = require('../../lib/firebase-lite/firestore');
const { FieldValue, Timestamp } = require('../../lib/firebase-lite/values');
const { createD1Backend, createMemoryDriver } = require('../../lib/firebase-lite/d1-backend');

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

// #2222: D1 de verdade é SQLite; aqui um fetch falso executa o SQL num SQLite em memória (Node 22+).
function d1Falso() {
  let sqlite = null;
  try { sqlite = require('node:sqlite'); } catch { return null; }
  const db = new sqlite.DatabaseSync(':memory:');
  const sqls = [];
  const run = st => { sqls.push(st.sql); const p = db.prepare(st.sql); return /^\s*select/i.test(st.sql) ? p.all(...(st.params || [])) : (p.run(...(st.params || [])), []); };
  const fetchImpl = async (url, init) => {
    const b = JSON.parse(init.body);
    const result = (b.batch || [b]).map(st => ({ results: run(st) }));
    return { ok: true, status: 200, json: async () => ({ success: true, result }) };
  };
  return { fetchImpl, sqls, db };
}

test('D1-6. #2222: igualdade em texto vai para o SQL com índice e o resultado continua igual', async () => {
  const f = d1Falso();
  const { createD1Driver } = require('../../lib/firebase-lite/d1-backend');
  const { Firestore } = require('../../lib/firebase-lite/firestore');
  if (!f) {
    const sqls = [];
    const fetchImpl = async (u, i) => { sqls.push(JSON.parse(i.body)); return { ok: true, status: 200, json: async () => ({ success: true, result: [{ results: [] }] }) }; };
    const backend = createD1Backend({ driver: createD1Driver({ token: 't', accountId: 'a', databaseId: 'id', fetchImpl }) });
    const db = new Firestore({ projectId: backend.projectId, getToken: async () => '' });
    db._backend = backend;
    await db.collection('vault_projects').where('tenant_id', '==', 't1').get();
    const sel = sqls.map(s => s.sql || '').find(s => /^SELECT/.test(s));
    assert.match(sel, /json_extract\(fields, '\$\.tenant_id\.stringValue'\) = \?/);
    assert.ok(sqls.some(s => /CREATE INDEX IF NOT EXISTS docs_eq_tenant_id/.test(s.sql || '')));
    return;
  }
  const backend = createD1Backend({ driver: createD1Driver({ token: 't', accountId: 'a', databaseId: 'id', fetchImpl: f.fetchImpl }) });
  const db = new Firestore({ projectId: backend.projectId, getToken: async () => '' });
    db._backend = backend;
  for (let i = 0; i < 20; i++) await db.collection('vault_projects').doc(`p${i}`).set({ tenant_id: i < 3 ? 't1' : 't2', status: i === 1 ? 'ok' : 'novo', n: i });
  const s1 = await db.collection('vault_projects').where('tenant_id', '==', 't1').get();
  assert.deepEqual(s1.docs.map(d => d.id).sort(), ['p0', 'p1', 'p2']);
  const s2 = await db.collection('vault_projects').where('tenant_id', '==', 't1').where('status', '==', 'ok').get();
  assert.deepEqual(s2.docs.map(d => d.id), ['p1']);
  const s3 = await db.collection('vault_projects').where('n', '>=', 18).get();
  assert.equal(s3.size, 2);
  const plano = f.db.prepare("EXPLAIN QUERY PLAN SELECT * FROM docs WHERE col = ? AND parent = ? AND json_extract(fields, '$.tenant_id.stringValue') = ?").all('vault_projects', '', 't1');
  assert.ok(plano.some(r => /docs_eq_tenant_id/.test(r.detail)), JSON.stringify(plano));
});
