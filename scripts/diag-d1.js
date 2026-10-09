'use strict';
// Teste ao vivo do banco de reserva no Cloudflare D1: cria o banco (se faltar), grava, lê, consulta, transação e Vault.
const { createD1Backend, createD1Driver } = require('../lib/firebase-lite/d1-backend');
const { Firestore } = require('../lib/firebase-lite/firestore');
const { createVault, createExecutionContext } = require('../nexia-ai/vault');

async function passo(nome, fn) {
  try { const r = await fn(); console.log(`OK     ${nome}${r ? ` — ${r}` : ''}`); return true; } catch (e) { console.log(`FALHOU ${nome} — ${e.status || ''} ${String(e.message).slice(0, 400)}`); return false; }
}

async function main() {
  const token = process.env.CLOUDFLARE_API_TOKEN, accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  console.log(`token: ${token ? 'presente' : 'AUSENTE'}; conta: ${accountId ? 'presente' : 'AUSENTE'}`);
  const backend = createD1Backend({ driver: createD1Driver({ token, accountId, databaseName: process.env.NEXIA_D1_NAME || 'nexia-cortex' }) });
  const db = new Firestore({ projectId: backend.projectId, getToken: async () => '' });
  db._backend = backend;
  const t0 = Date.now();
  let ok = true;
  const run = async (n, f) => { ok = (await passo(n, f)) && ok; };
  await run('escrever documento', async () => { await db.collection('diag_tmp').doc('d1').set({ t: Date.now(), n: 1 }); });
  await run('ler documento', async () => { const s = await db.collection('diag_tmp').doc('d1').get(); if (!s.exists) throw new Error('não achou'); return `n=${s.data().n}`; });
  await run('consulta com filtro', async () => { const s = await db.collection('diag_tmp').where('n', '==', 1).limit(5).get(); return `${s.size} doc(s)`; });
  await run('transação', async () => { await db.runTransaction(async tx => { const r = db.collection('diag_tmp').doc('d1'); const s = await tx.get(r); tx.update(r, { n: s.data().n + 1 }); }); });
  await run('Vault: criar e apagar cliente', async () => {
    const tenantDb = new Firestore({ projectId: 'nexia-d1-tenant', getToken: async () => '' });
    tenantDb._backend = backend;
    await tenantDb.collection('tenants').doc('nexia').set({ name: 'NEXIA', status: 'active' });
    const vault = createVault({ db, tenantDb });
    const ctx = createExecutionContext({ tenantId: 'nexia', actor: { type: 'user', id: 'diag-d1' } });
    const r = await vault.Client.create(ctx, { name: 'Diag D1', slug: `diag-d1-${Date.now()}`, status: 'active' });
    await vault.Client.softDelete(ctx, r.record.id, { expectedVersion: r.record.version });
    return r.record.id;
  });
  await run('apagar documento de teste', async () => { await db.collection('diag_tmp').doc('d1').delete(); });
  console.log(`\n${ok ? 'TUDO OK' : 'COM FALHAS'} em ${Date.now() - t0} ms`);
  if (!ok) process.exit(1);
}
main().catch(e => { console.error(e.message); process.exit(1); });
