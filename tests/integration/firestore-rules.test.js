'use strict';
// Regras do Firestore no Emulator (C2). Rodar com: npm run test:rules
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

let env;
const PROJECT = process.env.GCLOUD_PROJECT || 'demo-nexia';

test.before(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', '..', 'firestore.rules'), 'utf8'), host, port: Number(port) },
  });
});
test.after(async () => { if (env) await env.cleanup(); });

test.beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await db.doc('users/alice').set({ uid: 'alice', email: 'alice@a.com', role: 'user', tenantSlug: 'tenant-a', displayName: 'Alice' });
    await db.doc('users/bob').set({ uid: 'bob', email: 'bob@b.com', role: 'user', tenantSlug: 'tenant-b' });
    await db.doc('users/carol').set({ uid: 'carol', email: 'carol@a.com', role: 'user', tenantSlug: 'tenant-a' });
    await db.doc('users/admina').set({ uid: 'admina', role: 'admin', tenantSlug: 'tenant-a' });
    await db.doc('users/boss').set({ uid: 'boss', role: 'master', tenantSlug: 'nexia' });
    await db.doc('users/nx').set({ uid: 'nx', role: 'user', tenantSlug: 'nexia' });
    await db.doc('tenants/tenant-a').set({ slug: 'tenant-a', plan: 'free', name: 'A' });
    await db.doc('tenants/tenant-b').set({ slug: 'tenant-b', plan: 'pro', name: 'B' });
    await db.doc('tenants/tenant-b/cortex_memory/bob_default').set({ history: ['segredo do B'] });
    await db.doc('tenants/tenant-a/cortex_memory/carol_default').set({ history: ['segredo da Carol'] });
    await db.doc('tenants/tenant-a/cortex_memory/alice_default').set({ history: ['minha memória'] });
    await db.doc('tenants/tenant-b/clients/c1').set({ nome: 'Cliente B' });
  });
});

const as = uid => env.authenticatedContext(uid).firestore();

test('1. usuário normal não altera o próprio role', async () => {
  for (const role of ['master', 'admin', 'manager']) {
    await assertFails(as('alice').doc('users/alice').update({ role }));
  }
  await assertFails(as('alice').doc('users/alice').set({ uid: 'alice', role: 'master', tenantSlug: 'tenant-a' }));
});

test('2. usuário normal não altera tenantSlug nem outros campos de privilégio', async () => {
  await assertFails(as('alice').doc('users/alice').update({ tenantSlug: 'tenant-b' }));
  await assertFails(as('alice').doc('users/alice').update({ tenantSlug: 'nexia' }));
  await assertFails(as('alice').doc('users/alice').update({ tenant: 'tenant-b' }));
  await assertFails(as('alice').doc('users/alice').update({ plan: 'enterprise' }));
  await assertFails(as('alice').doc('users/alice').update({ isMaster: true }));
  await assertFails(as('alice').doc('users/alice').update({ email: 'admin@nexia.com' }));
});

test('2b. perfil novo não nasce privilegiado nem dentro de um tenant', async () => {
  await assertFails(as('eve').doc('users/eve').set({ uid: 'eve', role: 'master' }));
  await assertFails(as('eve').doc('users/eve').set({ uid: 'eve', role: 'user', tenantSlug: 'nexia' }));
  await assertFails(as('eve').doc('users/eve').set({ uid: 'eve', role: 'user', tenantSlug: 'tenant-b' }));
  await assertFails(as('eve').doc('users/mallory').set({ uid: 'mallory', role: 'user', tenantSlug: 'guest' }));
  await assertSucceeds(as('eve').doc('users/eve').set({ uid: 'eve', email: 'eve@e.com', role: 'user', tenantSlug: 'guest', onboardingDone: false }));
});

test('3. membro não acessa memória nem dados de outro tenant, nem a memória de colegas', async () => {
  await assertFails(as('alice').doc('tenants/tenant-b/cortex_memory/bob_default').get());
  await assertFails(as('alice').doc('tenants/tenant-b/clients/c1').get());
  await assertFails(as('alice').doc('tenants/tenant-b').get());
  await assertFails(as('alice').doc('tenants/tenant-a/cortex_memory/carol_default').get());
  await assertFails(as('alice').doc('tenants/tenant-b/cortex_memory/alice_default').set({ history: [] }));
  await assertFails(as('nx').doc('tenants/tenant-b/clients/c1').get(), 'tenant nexia não é privilégio');
  await assertFails(as('alice').doc('users/bob').get());
  await assertFails(env.unauthenticatedContext().firestore().doc('tenants/tenant-a').get());
});

test('3b. admin de tenant não altera plano/cobrança do tenant', async () => {
  await assertFails(as('admina').doc('tenants/tenant-a').update({ plan: 'enterprise' }));
  await assertFails(as('admina').doc('tenants/tenant-a').update({ billing: { status: 'paid' } }));
  await assertSucceeds(as('admina').doc('tenants/tenant-a').update({ name: 'A renomeado' }));
});

test('4. operações legítimas continuam permitidas', async () => {
  await assertSucceeds(as('alice').doc('users/alice').get());
  await assertSucceeds(as('alice').doc('users/alice').update({ displayName: 'Alice B.', onboardingDone: true }));
  await assertSucceeds(as('alice').doc('tenants/tenant-a/cortex_memory/alice_default').get());
  await assertSucceeds(as('alice').doc('tenants/tenant-a/cortex_memory/alice_default').set({ history: ['nova'] }));
  await assertSucceeds(as('alice').doc('tenants/tenant-a').get());
});

test('5. master legítimo mantém acesso e administra papéis', async () => {
  await assertSucceeds(as('boss').doc('tenants/tenant-b/clients/c1').get());
  await assertSucceeds(as('boss').doc('tenants/tenant-b/cortex_memory/bob_default').get());
  await assertSucceeds(as('boss').doc('users/alice').get());
  await assertSucceeds(as('boss').doc('users/alice').update({ role: 'admin' }));
  await assertSucceeds(as('boss').doc('tenants/tenant-b').update({ plan: 'enterprise' }));
});

test('6. catch-all de tenant não afrouxa subcoleções restritas', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await db.doc('tenants/tenant-a/billing/inv1').set({ total: 10 });
    await db.doc('tenants/tenant-a/audit_log/l1').set({ a: 1 });
    await db.doc('tenants/tenant-a/sentinel/s1').set({ a: 1 });
  });
  await assertFails(as('alice').doc('tenants/tenant-a/billing/inv1').get(), 'membro comum não lê billing');
  await assertFails(as('admina').doc('tenants/tenant-a/billing/inv1').set({ total: 0 }), 'admin não escreve billing');
  await assertFails(as('admina').doc('tenants/tenant-a/audit_log/l1').update({ a: 2 }), 'audit_log imutável');
  await assertFails(as('admina').doc('tenants/tenant-a/sentinel/s1').set({ a: 2 }));
  await assertSucceeds(as('admina').doc('tenants/tenant-a/billing/inv1').get());
  await assertSucceeds(as('alice').doc('tenants/tenant-a/clients/x').get(), 'subcoleção comum continua legível pelo membro');
});
