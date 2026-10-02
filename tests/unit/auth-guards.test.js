'use strict';
// Testes sem Firebase configurado: nenhuma requisição externa pode ganhar
// privilégio por token qualquer (demo mode), cabeçalho ou e-mail.
const test = require('node:test');
const assert = require('node:assert');

delete process.env.FIREBASE_SERVICE_ACCOUNT;
delete process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.MASTER_EMAIL;

const fn = name => require(`../../netlify/functions/${name}`);
const mw = fn('middleware');

const ev = (o = {}) => ({ httpMethod: 'POST', headers: {}, queryStringParameters: {}, body: '{}', ...o });

test('resolveRole: sem promoção por tenant, e-mail padrão ou e-mail não verificado (C3)', () => {
  assert.strictEqual(mw.resolveRole({ uid: 'u', email: 'admin@nexia.com' }, { role: 'user', tenantSlug: 'nexia' }), 'user');
  assert.strictEqual(mw.resolveRole({ uid: 'u', email: 'x@y.com' }, { role: 'user', tenantSlug: 'nexia' }), 'user');
  assert.strictEqual(mw.resolveRole({ uid: 'u' }, null), 'user');
  assert.strictEqual(mw.resolveRole({ uid: 'u', role: 'master' }, { role: 'user' }), 'master', 'custom claim definido pelo servidor');
  assert.strictEqual(mw.resolveRole({ uid: 'u' }, { role: 'master' }), 'master', 'master legítimo no perfil');
  process.env.MASTER_EMAIL = 'dono@exemplo.com';
  try {
    assert.strictEqual(mw.resolveRole({ uid: 'u', email: 'dono@exemplo.com', email_verified: false }, {}), 'user');
    assert.strictEqual(mw.resolveRole({ uid: 'u', email: 'dono@exemplo.com' }, {}), 'user');
    assert.strictEqual(mw.resolveRole({ uid: 'u', email: 'DONO@exemplo.com', email_verified: true }, {}), 'master');
  } finally { delete process.env.MASTER_EMAIL; }
});

test('demo mode removido: qualquer token sem Firebase Admin é rejeitado (A3)', async () => {
  for (const token of ['demo', 'x', 'fake-token-123', 'eyJhbGciOiJub25lIn0.e30.']) {
    const r = await mw.verifyBearerToken(ev({ headers: { authorization: `Bearer ${token}` } }));
    assert.strictEqual(r.ok, false, token);
    assert.notStrictEqual(r.role, 'master');
  }
  assert.strictEqual((await mw.verifyBearerToken(ev())).ok, false);
});

test('guard sem token responde 401', async () => {
  const r = await mw.guard(ev({ body: JSON.stringify({ tenantId: 'nexia', userId: 'alguem' }) }), 'cortex-chat');
  assert.strictEqual(r.statusCode, 401);
});

test('validateTenant falha fechado sem Firestore', async () => {
  const r = await mw.validateTenant('u1', 'nexia');
  assert.strictEqual(r.ok, false);
});

test('Sentinel: cabeçalho x-netlify-event não dispensa autenticação (C4)', async () => {
  const sentinel = fn('sentinel');
  for (const body of [{ mode: 'heal', issues: [{ severity: 'CRITICAL', issue: 'x' }] }, { mode: 'scan' }]) {
    const r = await sentinel.handler(ev({ headers: { 'x-netlify-event': 'schedule' }, body: JSON.stringify(body) }));
    assert.strictEqual(r.statusCode, 401, JSON.stringify(body));
  }
  const r2 = await sentinel.handler(ev({ headers: { 'x-netlify-event': 'schedule', authorization: 'Bearer demo' }, body: JSON.stringify({ mode: 'heal', issues: [{}] }) }));
  assert.strictEqual(r2.statusCode, 401);
});

test('endpoints sensíveis exigem autenticação (A1, A2)', async () => {
  const cases = [
    ['autocommit', ev({ body: JSON.stringify({ file: 'a.js', content: 'x', branch: 'main' }) })],
    ['observability', ev({ httpMethod: 'GET' })],
    ['observability', ev({ body: JSON.stringify({ path: '/x', ms: 1 }) })],
    ['cortex-chat', ev({ body: JSON.stringify({ message: 'oi' }) })],
    ['cortex-memory', ev({ body: JSON.stringify({ action: 'get', tenantId: 'outro' }) })],
    ['tenant-admin', ev({ httpMethod: 'GET', queryStringParameters: { tenantId: 'outro' } })],
  ];
  for (const [name, e] of cases) {
    const r = await fn(name).handler(e);
    assert.ok([401, 503].includes(r.statusCode), `${name} → ${r.statusCode}`);
  }
});

test('metrics-aggregator: sem segredo configurado ou com segredo errado → 401', async () => {
  const m = fn('metrics-aggregator');
  delete process.env.METRICS_SECRET;
  assert.strictEqual((await m.handler(ev({ httpMethod: 'GET' }))).statusCode, 401);
  process.env.METRICS_SECRET = 'a'.repeat(40);
  try {
    assert.strictEqual((await m.handler(ev({ httpMethod: 'GET', headers: { authorization: 'Bearer errado' } }))).statusCode, 401);
    const body = (await m.handler(ev({ httpMethod: 'GET', headers: { authorization: 'Bearer errado' } }))).body;
    assert.ok(!body.includes('a'.repeat(40)));
  } finally { delete process.env.METRICS_SECRET; }
});

test('erros internos não vazam detalhes ao cliente (A5)', () => {
  const { publicErrorBody } = require('../../lib/safe-error');
  const orig = console.error; console.error = () => {};
  try {
    const b = publicErrorBody('t', new Error('ENOENT /home/app/.env token=abc'));
    assert.ok(!JSON.stringify(b).includes('ENOENT'));
    assert.match(b.correlationId, /^[0-9a-f]{16}$/);
  } finally { console.error = orig; }
});
