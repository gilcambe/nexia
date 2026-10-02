'use strict';
// Vault (Fase 2): regras do Firestore para vault_* no Emulator.
// Documentos criados pela própria camada de acesso (Admin SDK); leituras e escritas
// testadas como cliente. Rodar com: npm run test:rules
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { createVault, createExecutionContext, SCHEMAS, ENTITY_NAMES } = require('../../nexia-ai/vault');
const { AUDIT_COLLECTION, IDEMPOTENCY_COLLECTION, UNIQUE_COLLECTION } = require('../../nexia-ai/vault/repository');
const { valid, ORDER } = require('../vault-fixtures');

const PROJECT = process.env.GCLOUD_PROJECT || 'demo-nexia';
const RUN = crypto.randomBytes(4).toString('hex');
const TA = `vrules-a-${RUN}`;
const TB = `vrules-b-${RUN}`;
let env, db;
const ids = { [TA]: {}, [TB]: {} };
const internal = { [TA]: {} };

test.before(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', '..', 'firestore.rules'), 'utf8'), host, port: Number(port) },
  });
  ({ db } = require('../../netlify/functions/firebase-init'));
  const vault = createVault({ db });
  for (const t of [TA, TB]) {
    await db.doc(`tenants/${t}`).set({ slug: t, name: t, plan: 'free' });
    const ctx = createExecutionContext({ tenantId: t, actor: { type: 'user', id: 'gilcambe' } });
    for (const e of ORDER) {
      const opts = e === 'TestRun' ? { idempotencyKey: `ci-${RUN}-${t}` } : {};
      ids[t][e] = (await vault[e].create(ctx, valid[e](ids[t]), opts)).record.id;
    }
  }
  const pick = async col => (await db.collection(col).where('tenant_id', '==', TA).limit(1).get()).docs[0].id;
  internal[TA] = { audit: await pick(AUDIT_COLLECTION), idem: await pick(IDEMPOTENCY_COLLECTION), unique: await pick(UNIQUE_COLLECTION) };

  const users = {
    [`user-${RUN}`]: { role: 'user', tenantSlug: TA },
    [`manager-${RUN}`]: { role: 'manager', tenantSlug: TA },
    [`admina-${RUN}`]: { role: 'admin', tenantSlug: TA },
    [`adminb-${RUN}`]: { role: 'admin', tenantSlug: TB },
    [`boss-${RUN}`]: { role: 'master', tenantSlug: 'nexia' },
  };
  for (const [uid, p] of Object.entries(users)) await db.doc(`users/${uid}`).set({ uid, ...p });
});
test.after(async () => { if (env) await env.cleanup(); });

const as = (who, claims) => env.authenticatedContext(`${who}-${RUN}`, claims).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const docOf = (fs_, t, e) => fs_.collection(SCHEMAS[e].collection).doc(ids[t][e]);

test('V1. sem login e usuário comum não leem nada do Vault (get e list, 16 coleções)', async () => {
  for (const who of [null, 'user', 'manager']) {
    const f = who ? as(who) : anon();
    for (const e of ENTITY_NAMES) {
      await assertFails(docOf(f, TA, e).get());
      await assertFails(f.collection(SCHEMAS[e].collection).where('tenant_id', '==', TA).get());
    }
    await assertFails(f.collection(AUDIT_COLLECTION).doc(internal[TA].audit).get());
  }
});

test('V2. admin do tenant lê só o próprio tenant', async () => {
  const f = as('admina');
  for (const e of ENTITY_NAMES) {
    await assertSucceeds(docOf(f, TA, e).get());
    await assertFails(docOf(f, TB, e).get());
  }
  await assertSucceeds(f.collection(SCHEMAS.Project.collection).where('tenant_id', '==', TA).get());
  await assertFails(f.collection(SCHEMAS.Project.collection).where('tenant_id', '==', TB).get());
  await assertFails(f.collection(SCHEMAS.Project.collection).get()); // consulta sem filtro de tenant
  await assertSucceeds(f.collection(AUDIT_COLLECTION).doc(internal[TA].audit).get());
  // admin do tenant B não lê o tenant A
  const g = as('adminb');
  await assertFails(docOf(g, TA, 'Project').get());
  await assertFails(g.collection(SCHEMAS.Project.collection).where('tenant_id', '==', TA).get());
});

test('V3. master lê qualquer tenant (perfil ou custom claim)', async () => {
  for (const f of [as('boss'), as('claim', { role: 'master' })]) {
    for (const e of ENTITY_NAMES) {
      await assertSucceeds(docOf(f, TA, e).get());
      await assertSucceeds(docOf(f, TB, e).get());
    }
    await assertSucceeds(f.collection(SCHEMAS.Memory.collection).get());
    await assertSucceeds(f.collection(AUDIT_COLLECTION).doc(internal[TA].audit).get());
  }
  // claim diferente de master sem perfil: negado
  await assertFails(docOf(as('claimadmin', { role: 'admin' }), TA, 'Project').get());
});

test('V4. nenhum cliente grava no Vault, nem master (create, update, delete)', async () => {
  for (const who of ['user', 'admina', 'boss']) {
    const f = as(who);
    for (const e of ENTITY_NAMES) {
      const col = f.collection(SCHEMAS[e].collection);
      await assertFails(col.doc(`${SCHEMAS[e].idPrefix}_${crypto.randomBytes(16).toString('hex')}`).set({ tenant_id: TA }));
      await assertFails(docOf(f, TA, e).update({ version: 99 }));
      await assertFails(docOf(f, TA, e).delete());
    }
    for (const col of [AUDIT_COLLECTION, IDEMPOTENCY_COLLECTION, UNIQUE_COLLECTION]) {
      await assertFails(f.collection(col).doc('x').set({ tenant_id: TA }));
    }
    await assertFails(f.collection(AUDIT_COLLECTION).doc(internal[TA].audit).delete());
  }
});

test('V5. coleções internas (idempotência e unicidade) não são legíveis por ninguém no cliente', async () => {
  for (const who of ['admina', 'boss']) {
    const f = as(who);
    await assertFails(f.collection(IDEMPOTENCY_COLLECTION).doc(internal[TA].idem).get());
    await assertFails(f.collection(UNIQUE_COLLECTION).doc(internal[TA].unique).get());
    await assertFails(f.collection(IDEMPOTENCY_COLLECTION).where('tenant_id', '==', TA).get());
  }
  await assertFails(as('claim', { role: 'master' }).collection(UNIQUE_COLLECTION).doc(internal[TA].unique).get());
});

test('V6. a regra do Vault não abre coleções fora do prefixo vault_', async () => {
  await env.withSecurityRulesDisabled(async c => { await c.firestore().doc(`vaultx/${RUN}`).set({ tenant_id: TA }); });
  await assertFails(as('boss').doc(`vaultx/${RUN}`).get());
  await assertFails(as('admina').doc(`vaultx/${RUN}`).get());
  assert.ok(true);
});
