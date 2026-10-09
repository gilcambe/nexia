// Diagnóstico do Vault no banco B: tenta a mesma coisa que o "criar cliente" do smoke e mostra o erro completo
// (código, mensagem e quantidade de documentos lidos/escritos). Não grava dados de cliente; apaga o que criar.
const { vaultDb } = require('../netlify/functions/firebase-vault');
const { createVault, createExecutionContext } = require('../nexia-ai/vault');

async function passo(nome, fn) {
  try { const r = await fn(); console.log(`OK     ${nome}${r ? ` — ${r}` : ''}`); return true; }
  catch (e) { console.log(`FALHOU ${nome} — ${e.code || ''} ${String(e.message).slice(0, 500)} ${e.details ? JSON.stringify(e.details).slice(0, 300) : ''}`); return false; }
}

async function main() {
  const db = vaultDb();
  const main = require('../netlify/functions/firebase-init').db;
  console.log(`banco do Vault: ${db.projectId}; banco principal: ${main.projectId}; separados: ${db !== main}`);
  await passo('ler documento no banco B', async () => { await db.collection('diag_tmp').doc('b').get(); });
  await passo('escrever no banco B', async () => { await db.collection('diag_tmp').doc('b').set({ t: Date.now() }); });
  await passo('transação no banco B', async () => { await db.runTransaction(async tx => { const s = await tx.get(db.collection('diag_tmp').doc('b')); tx.set(db.collection('diag_tmp').doc('b'), { t: Date.now(), antes: s.exists }); }); });
  await passo('ler tenant "nexia" no banco principal', async () => { const s = await main.collection('tenants').doc('nexia').get(); return `existe=${s.exists}`; });
  await passo('ler tenant "nexia" no banco B', async () => { const s = await db.collection('tenants').doc('nexia').get(); return `existe=${s.exists}`; });
  const vault = createVault({ db, ...(db !== main ? { tenantDb: main } : {}) });
  const ctx = createExecutionContext({ tenantId: 'nexia', actor: { type: 'user', id: 'diag' } });
  await passo('Vault: criar cliente de diagnóstico', async () => { const r = await vault.Client.create(ctx, { name: 'Diag', slug: `diag-${Date.now()}`, status: 'active' }); await vault.Client.softDelete(ctx, r.record.id, { expectedVersion: r.record.version }).catch(() => {}); return r.record.id; });
  console.log(`operações do banco B: ${JSON.stringify(db.ops)}; principal: ${JSON.stringify(main.ops)}`);
}
main().catch(e => { console.log('Erro:', e.message); process.exit(1); });
