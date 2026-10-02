'use strict';
// Autorização da API contra os emuladores de Auth e Firestore (C3, C4, A1, A2,
// isolamento de tenant). Rodar com: npm run test:rules
const test = require('node:test');
const assert = require('node:assert');
const { rawRequest, startServer } = require('../helpers');

const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST;
let srv, admin, db;
const tokens = {};

async function signUp(email, password = 'senha-forte-123') {
  const r = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const j = await r.json();
  if (!j.idToken) throw new Error('signUp falhou: ' + JSON.stringify(j));
  return { uid: j.localId, idToken: j.idToken };
}
async function signIn(email, password = 'senha-forte-123') {
  const r = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  return (await r.json()).idToken;
}

const call = (path, token, body, method = 'POST', extra = {}) => rawRequest(srv.port, path, {
  method, body: body === undefined ? undefined : JSON.stringify(body),
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra },
});

test.before(async () => {
  assert.ok(AUTH && process.env.FIRESTORE_EMULATOR_HOST, 'rode via `npm run test:rules` (emuladores)');
  delete process.env.MASTER_EMAIL;
  ({ admin, db } = require('../../netlify/functions/firebase-init'));
  assert.ok(db, 'firebase-init deveria conectar ao emulador');
  srv = await startServer();

  const users = {
    guest: ['guest@t.com', { role: 'user', tenantSlug: 'guest' }],
    nexiaUser: ['nx@t.com', { role: 'user', tenantSlug: 'nexia' }],
    fakeAdmin: ['admin@nexia.com', { role: 'user', tenantSlug: 'guest' }],
    alice: ['alice@a.com', { role: 'user', tenantSlug: 'tenant-a' }],
    bob: ['bob@b.com', { role: 'user', tenantSlug: 'tenant-b' }],
    boss: ['boss@nexia.com', { role: 'master', tenantSlug: 'nexia' }],
  };
  for (const [k, [email, profile]] of Object.entries(users)) {
    const { uid, idToken } = await signUp(email);
    tokens[k] = { uid, idToken };
    await db.doc(`users/${uid}`).set({ uid, email, ...profile });
  }
  for (const slug of ['nexia', 'tenant-a', 'tenant-b']) await db.doc(`tenants/${slug}`).set({ slug, name: slug, plan: 'free' });
  await db.doc(`tenants/tenant-a/members/${tokens.alice.uid}`).set({ role: 'master' }); // papel global não vem de tenant
});
test.after(async () => { if (srv) await srv.close(); });

test('C3: guest não é promovido ao chamar o tenant nexia (sem auto-reparo)', async () => {
  const r = await call('/api/memory', tokens.guest.idToken, { action: 'get', tenantId: 'nexia' });
  assert.strictEqual(r.status, 403);
  const doc = (await db.doc(`users/${tokens.guest.uid}`).get()).data();
  assert.strictEqual(doc.tenantSlug, 'guest');
});

test('C3: pertencer ao tenant nexia, e-mail admin@nexia.com sem verificação ou papel master em members não dão master', async () => {
  for (const k of ['nexiaUser', 'fakeAdmin', 'alice']) {
    const r = await call('/api/autocommit', tokens[k].idToken, { file: 'a.js', content: 'x', branch: 'feature/x' });
    assert.strictEqual(r.status, 403, k);
    assert.match(r.body, /Permissão insuficiente/, k);
  }
});

test('C3: MASTER_EMAIL só vale com e-mail verificado', async () => {
  process.env.MASTER_EMAIL = 'admin@nexia.com';
  try {
    let r = await call('/api/autocommit', tokens.fakeAdmin.idToken, { file: 'a.js', content: 'x', branch: 'feature/x' });
    assert.strictEqual(r.status, 403);
    assert.match(r.body, /Permissão insuficiente/);
    await admin.auth().updateUser(tokens.fakeAdmin.uid, { emailVerified: true });
    const verified = await signIn('admin@nexia.com');
    r = await call('/api/autocommit', verified, { file: 'a.js', content: 'x', branch: 'feature/x' });
    assert.strictEqual(r.status, 403);
    assert.match(r.body, /Autocommit desativado/, 'passa da checagem de papel e para na feature flag');
  } finally { delete process.env.MASTER_EMAIL; }
});

test('A1: autocommit desligado por padrão, mesmo para master', async () => {
  const r = await call('/api/autocommit', tokens.boss.idToken, { file: 'a.js', content: 'x', branch: 'main' });
  assert.strictEqual(r.status, 403);
  assert.match(r.body, /desativado/);
});

test('C4: cabeçalho de agendamento não dá acesso e heal fica bloqueado', async () => {
  let r = await call('/api/sentinel-qa', null, { mode: 'heal', issues: [{ severity: 'CRITICAL' }] }, 'POST', { 'x-netlify-event': 'schedule' });
  assert.strictEqual(r.status, 401);
  r = await call('/api/sentinel-qa', tokens.alice.idToken, { mode: 'heal', issues: [{ severity: 'CRITICAL' }] }, 'POST', { 'x-netlify-event': 'schedule' });
  assert.strictEqual(r.status, 403);
  r = await call('/api/sentinel-qa', tokens.boss.idToken, { mode: 'heal', issues: [{ severity: 'CRITICAL' }] });
  assert.strictEqual(r.status, 403);
  assert.match(r.body, /desativado/);
});

test('C4: aplicação de overrides do Sentinel não grava nada, mesmo com fix malicioso', async () => {
  const sentinel = require('../../netlify/functions/sentinel');
  const before = (await db.doc(`users/${tokens.alice.uid}`).get()).data();
  const res = await sentinel._applyFirestoreOverrides([{ canAutoFix: true, issue: 'x', firestoreOverride: { collection: 'users', doc: tokens.alice.uid, data: { role: 'master' } } }]);
  assert.strictEqual(res.applied, 0);
  const after = (await db.doc(`users/${tokens.alice.uid}`).get()).data();
  assert.deepStrictEqual(after, before);
  const rd = await sentinel._triggerRedeploy('teste');
  assert.strictEqual(rd.triggered, false);
});

test('A2: observabilidade exige admin', async () => {
  assert.strictEqual((await call('/api/observability', null, undefined, 'GET')).status, 401);
  assert.strictEqual((await call('/api/observability', tokens.alice.idToken, undefined, 'GET')).status, 403);
  assert.strictEqual((await call('/api/observability', tokens.boss.idToken, undefined, 'GET')).status, 200);
});

test('isolamento de tenant: alice (tenant-a) não lê nem altera tenant-b', async () => {
  assert.strictEqual((await call('/api/tenant?tenantId=tenant-b', tokens.alice.idToken, undefined, 'GET')).status, 403);
  assert.strictEqual((await call('/api/memory', tokens.alice.idToken, { action: 'get', tenantId: 'tenant-b' })).status, 403);
  assert.strictEqual((await call('/api/tenant', tokens.alice.idToken, { action: 'updatePlan', tenantId: 'tenant-a', plan: 'enterprise' })).status, 403);
  assert.strictEqual((await call('/api/crm?phone=11999999999', tokens.alice.idToken, undefined, 'GET')).status, 403);
  assert.strictEqual((await call(`/api/notifications?userId=${tokens.bob.uid}`, tokens.alice.idToken, undefined, 'GET')).status, 403);
  assert.strictEqual((await call('/api/swarm', tokens.alice.idToken, { task: 'oi', tenantId: 'tenant-b' })).status, 403);
  const plan = (await db.doc('tenants/tenant-a').get()).data().plan;
  assert.strictEqual(plan, 'free');
});

test('operações legítimas continuam funcionando', async () => {
  assert.strictEqual((await call('/api/tenant?tenantId=tenant-a', tokens.alice.idToken, undefined, 'GET')).status, 200);
  assert.strictEqual((await call('/api/memory', tokens.alice.idToken, { action: 'get', tenantId: 'tenant-a' })).status, 200);
  assert.strictEqual((await call(`/api/notifications?userId=${tokens.alice.uid}`, tokens.alice.idToken, undefined, 'GET')).status, 200);
  assert.strictEqual((await call('/api/tenant?tenantId=tenant-b', tokens.boss.idToken, undefined, 'GET')).status, 200, 'master mantém acesso');
});

test('master via custom claim (operação administrativa) é reconhecido', async () => {
  await admin.auth().setCustomUserClaims(tokens.bob.uid, { role: 'master' });
  const t = await signIn('bob@b.com');
  assert.strictEqual((await call('/api/tenant?tenantId=tenant-a', t, undefined, 'GET')).status, 200);
});
