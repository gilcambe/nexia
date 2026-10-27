'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const { CofreSql } = require('../../src/durable/CofreSql');

// storage.sql do Durable Object imitado: SQLite do Node 22+ (no Node 20, um falso que só guarda o SQL).
function storageSql() {
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(':memory:');
    return { real: true, exec: (sql, ...p) => { const st = db.prepare(sql); const rows = /^\s*select/i.test(sql) ? st.all(...p) : (st.run(...p), []); return { toArray: () => rows }; } };
  } catch {
    const vistos = [];
    return { real: false, vistos, exec: (sql) => { vistos.push(sql); return { toArray: () => [] }; } };
  }
}

test('CS1. #2188: o Vault roda em cima do banco do Worker (Durable Object SQLite) pelo driver do D1', async () => {
  const sql = storageSql();
  const objeto = new CofreSql({ storage: { sql } });
  const ns = { idFromName: n => n, get: () => ({ fetch: (u, init) => objeto.fetch(new Request(u, init)) }) };
  globalThis.__NEXIA_COFRE__ = ns;
  try {
    const { criarBancoB } = require('../../netlify/functions/firebase-vault');
    const crypto = require('crypto');
    const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const sa = { project_id: 'b', client_email: 'x@b.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
    const db = criarBancoB({ FIREBASE_SERVICE_ACCOUNT_B: JSON.stringify(sa) });
    assert.deepEqual(db._bancos.map(b => b.projectId), ['b', 'nexia-do']);
    db._usar(db._bancos[1]);
    db._esgotados.set('b', Date.now() + 3600e3);
    await db.collection('vault_clients').doc('c1').set({ tenant_id: 't1', nome: 'Teste' });
    if (!sql.real) { assert.ok(sql.vistos.some(s => /INSERT INTO docs/.test(s))); return; }
    const snap = await db.collection('vault_clients').where('tenant_id', '==', 't1').get();
    assert.deepEqual(snap.docs.map(d => d.data().nome), ['Teste']);
    assert.equal((await db.collection('vault_clients').doc('c1').get()).data().tenant_id, 't1');
  } finally { delete globalThis.__NEXIA_COFRE__; }
});

test('CS2. limite do banco do Worker vira 429 (o rodízio entende como falta de cota)', async () => {
  const objeto = new CofreSql({ storage: { sql: { exec: () => { throw new Error('Exceeded allowed rows read in a day'); } } } });
  const r = await objeto.fetch(new Request('https://cofre/query', { method: 'POST', body: JSON.stringify({ sql: 'SELECT 1' }) }));
  assert.equal(r.status, 429);
});
