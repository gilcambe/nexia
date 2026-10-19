// Testes de permissões do Firestore (regras em firestore.rules).
// Requer o emulador do Firebase rodando (apenas firestore):
//   firebase emulators:start --only firestore --project demo-nexia
// Execução isolada: npm run test:firestore
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  initializeTestApp,
  loadFirestoreRules,
  clearFirestoreData,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');

const PROJECT_ID = 'demo-nexia';
const RULES_PATH = path.join(__dirname, '../../firestore.rules');

let passed = 0;
let failed = 0;

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`  OK   ${name}`);
      passed++;
    })
    .catch((err) => {
      console.log(`  FALHA ${name}: ${err.message}`);
      failed++;
    });
}

async function main() {
  const rules = fs.readFileSync(RULES_PATH, 'utf8');
  await loadFirestoreRules({ projectId: PROJECT_ID, rules });

  const authed = initializeTestApp({
    projectId: PROJECT_ID,
    auth: { uid: 'user-a' },
  });
  const authedDb = authed.firestore();

  const master = initializeTestApp({
    projectId: PROJECT_ID,
    auth: { uid: 'master-1', token: { role: 'master' } },
  });
  const masterDb = master.firestore();

  const unauthed = initializeTestApp({ projectId: PROJECT_ID });
  const unauthedDb = unauthed.firestore();

  await clearFirestoreData();

  // ── /users/{userId} ────────────────────────────────────────
  await test('usuário autenticado lê próprio perfil', () =>
    assertSucceeds(authedDb.doc('users/user-a').get())
  );
  await test('usuário autenticado não lê perfil alheio', () =>
    assertFails(authedDb.doc('users/user-b').get())
  );
  await test('usuário não autenticado não lê perfil', () =>
    assertFails(unauthedDb.doc('users/user-a').get())
  );
  await test('master lê qualquer perfil', () =>
    assertSucceeds(masterDb.doc('users/user-b').get())
  );
  await test('usuário autenticado não cria perfil alheio', () =>
    assertFails(authedDb.doc('users/user-b').set({ role: 'user' }))
  );
  await test('usuário autenticado não altera campos protegidos (role)', () =>
    assertFails(authedDb.doc('users/user-a').update({ role: 'admin' }))
  );
  await test('usuário autenticado não deleta perfil alheio', () =>
    assertFails(authedDb.doc('users/user-b').delete())
  );

  // ── /tenants/{tenantSlug} ──────────────────────────────────
  await test('usuário autenticado sem tenant não lê tenant', () =>
    assertFails(authedDb.doc('tenants/acme').get())
  );
  await test('master lê tenant qualquer', () =>
    assertSucceeds(masterDb.doc('tenants/acme').get())
  );
  await test('usuário não autenticado não lê tenant', () =>
    assertFails(unauthedDb.doc('tenants/acme').get())
  );
  await test('usuário autenticado não cria tenant', () =>
    assertFails(authedDb.doc('tenants/novo').set({ plan: 'free' }))
  );

  // ── /tenants/{tenantSlug}/members ──────────────────────────
  await test('usuário autenticado do tenant lê members', () =>
    assertSucceeds(authedDb.doc('tenants/acme/members/m1').get())
  );
  await test('usuário autenticado não escreve members (não é admin)', () =>
    assertFails(authedDb.doc('tenants/acme/members/m1').set({ role: 'user' }))
  );

  // ── /tenants/{tenantSlug}/billing ──────────────────────────
  await test('usuário autenticado não lê billing (não é admin do tenant)', () =>
    assertFails(authedDb.doc('tenants/acme/billing/inv1').get())
  );
  await test('master lê billing', () =>
    assertSucceeds(masterDb.doc('tenants/acme/billing/inv1').get())
  );
  await test('usuário autenticado não escreve billing', () =>
    assertFails(authedDb.doc('tenants/acme/billing/inv1').set({ plan: 'pago' }))
  );
  await test('master escreve billing', () =>
    assertSucceeds(masterDb.doc('tenants/acme/billing/inv1').set({ plan: 'pago' }))
  );

  // ── /nexia_config/{docId} ──────────────────────────────────
  await test('usuário autenticado lê nexia_config', () =>
    assertSucceeds(authedDb.doc('nexia_config/site').get())
  );
  await test('usuário não autenticado não lê nexia_config', () =>
    assertFails(unauthedDb.doc('nexia_config/site').get())
  );
  await test('usuário autenticado não escreve nexia_config', () =>
    assertFails(authedDb.doc('nexia_config/site').set({ a: 1 }))
  );
  await test('master escreve nexia_config', () =>
    assertSucceeds(masterDb.doc('nexia_config/site').set({ a: 1 }))
  );

  // ── /system/{docId} ────────────────────────────────────────
  await test('usuário autenticado não lê system', () =>
    assertFails(authedDb.doc('system/health').get())
  );
  await test('master lê system', () =>
    assertSucceeds(masterDb.doc('system/health').get())
  );
  await test('usuário autenticado não escreve system', () =>
    assertFails(authedDb.doc('system/health').set({ ok: true }))
  );

  // ── /system_status/{docId} ─────────────────────────────────
  await test('usuário não autenticado não lê system_status', () =>
    assertFails(unauthedDb.doc('system_status/s1').get())
  );
  await test('usuário autenticado comum não lê system_status', () =>
    assertFails(authedDb.doc('system_status/s1').get())
  );
  await test('admin lê system_status', () => {
    const admin = initializeTestApp({
      projectId: PROJECT_ID,
      auth: { uid: 'admin-1', token: { role: 'admin' } },
    });
    return assertSucceeds(admin.firestore().doc('system_status/s1').get()).then(() => admin.deleteApp());
  });
  await test('usuário autenticado não escreve system_status', () =>
    assertFails(authedDb.doc('system_status/s1').set({ scan: 'ok' }))
  );

  // ── /sentinel_reports e /sentinel_heals (apenas backend) ───
  await test('usuário autenticado não lê sentinel_reports', () =>
    assertFails(authedDb.doc('sentinel_reports/r1').get())
  );
  await test('admin lê sentinel_reports', () => {
    const admin = initializeTestApp({
      projectId: PROJECT_ID,
      auth: { uid: 'admin-1', token: { role: 'admin' } },
    });
    return assertSucceeds(admin.firestore().doc('sentinel_reports/r1').get()).then(() => admin.deleteApp());
  });
  await test('usuário autenticado não escreve sentinel_heals', () =>
    assertFails(authedDb.doc('sentinel_heals/h1').set({ ok: true }))
  );

  // ── /vault_* ───────────────────────────────────────────────
  await test('usuário autenticado não lê vault_* (não é master nem admin do tenant)', () =>
    assertFails(authedDb.doc('vault_docs/v1').get())
  );
  await test('usuário autenticado não escreve vault_*', () =>
    assertFails(authedDb.doc('vault_docs/v1').set({ tenant_id: 'acme', data: {} }))
  );

  // ── Default: nega tudo o resto ─────────────────────────────
  await test('usuário autenticado não lê coleção desconhecida', () =>
    assertFails(authedDb.doc('qualquer_coisa/x').get())
  );
  await test('usuário autenticado não escreve coleção desconhecida', () =>
    assertFails(authedDb.doc('qualquer_coisa/x').set({ a: 1 }))
  );

  await authed.deleteApp();
  await master.deleteApp();
  await unauthed.deleteApp();

  console.log(`\n${passed} passou, ${failed} falhou`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('ERRO ao executar testes de permissões:', err.message);
  process.exit(1);
});
