'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getCachedFirestoreRead,
  setCachedFirestoreRead,
  invalidateFirestoreCache,
  DocumentReference,
  Firestore
} = require('../../lib/firebase-lite/firestore');

test('Cache em memória (TTL 60s) para leituras e invalidação na escrita', async (t) => {
  await t.test('grava e recupera documento do cache antes do TTL', () => {
    const tenantId = 't1';
    const coll = 'clientes';
    const docId = 'c123';
    const data = { nome: 'Cliente Teste', plano: 'pro' };

    setCachedFirestoreRead(tenantId, coll, docId, data);
    const cached = getCachedFirestoreRead(tenantId, coll, docId);

    assert.deepEqual(cached, data);
  });

  await t.test('invalida cache específico ao chamar invalidateFirestoreCache', () => {
    const tenantId = 't1';
    const coll = 'projetos';
    const docId = 'p999';
    const data = { titulo: 'Projeto Alpha' };

    setCachedFirestoreRead(tenantId, coll, docId, data);
    assert.deepEqual(getCachedFirestoreRead(tenantId, coll, docId), data);

    invalidateFirestoreCache(tenantId, coll, docId);
    assert.equal(getCachedFirestoreRead(tenantId, coll, docId), null);
  });

  await t.test('invalida cache de toda coleção quando docId não é fornecido', () => {
    const tenantId = 't2';
    const coll = 'tenants';

    setCachedFirestoreRead(tenantId, coll, 'doc1', { a: 1 });
    setCachedFirestoreRead(tenantId, coll, 'doc2', { b: 2 });

    invalidateFirestoreCache(tenantId, coll);
    assert.equal(getCachedFirestoreRead(tenantId, coll, 'doc1'), null);
    assert.equal(getCachedFirestoreRead(tenantId, coll, 'doc2'), null);
  });

  await t.test('DocumentReference usa cache na leitura e invalida na escrita/update/delete', async () => {
    const db = new Firestore();
    const docRef = db.collection('vault_test').doc('doc_cache');

    await docRef.set({ valor: 42 });
    const snap1 = await docRef.get();
    assert.equal(snap1.exists, true);
    assert.equal(snap1.data().valor, 42);

    await docRef.update({ valor: 84 });
    // Cache deve ter sido invalidado no update
    assert.equal(getCachedFirestoreRead('default', 'vault_test', 'doc_cache'), null);

    await docRef.delete();
    assert.equal(getCachedFirestoreRead('default', 'vault_test', 'doc_cache'), null);
  });
});
