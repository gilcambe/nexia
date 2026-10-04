'use strict';
// /api/nexia/* (Fase 3) contra o servidor real e os emuladores de Auth e Firestore.
// Onboarding: (a) módulo com a fonte local deste repositório; (b) endpoint HTTP lendo
// gilcambe/nexia no GitHub (precisa de rede; obrigatório no CI).
// Rodar com: npm run test:rules
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const crypto = require('crypto');
const { rawRequest, startServer } = require('../helpers');
const { createVault, createExecutionContext } = require('../../nexia-ai/vault');
const { onboardProject } = require('../../nexia-ai/onboarding');
const { createLocalSource } = require('../../nexia-ai/onboarding/sources');
const { fakeSecrets } = require('../vault-fixtures');

const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const RUN = crypto.randomBytes(4).toString('hex');
const TA = `api-a-${RUN}`;
const TB = `api-b-${RUN}`;
let srv, db;
const tok = {};

async function signUp(email) {
  const r = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'senha-forte-123', returnSecureToken: true }),
  });
  const j = await r.json();
  if (!j.idToken) throw new Error('signUp falhou');
  return j;
}

async function call(who, method, p, body, headers = {}) {
  const r = await rawRequest(srv.port, `/api/nexia${p}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...(who ? { Authorization: `Bearer ${tok[who].idToken}` } : {}), ...headers },
  });
  let json = null;
  try { json = JSON.parse(r.body); } catch { /* corpo vazio */ }
  return { status: r.status, headers: r.headers, body: json, raw: r.body };
}

test.before(async () => {
  assert.ok(AUTH && process.env.FIRESTORE_EMULATOR_HOST, 'rode via `npm run test:rules` (emuladores)');
  ({ db } = require('../../netlify/functions/firebase-init'));
  srv = await startServer();
  const users = {
    adminA: { role: 'admin', tenantSlug: TA }, adminB: { role: 'admin', tenantSlug: TB },
    userA: { role: 'user', tenantSlug: TA }, managerA: { role: 'manager', tenantSlug: TA },
    boss: { role: 'master', tenantSlug: 'nexia' }, bossNoTenant: { role: 'master' },
  };
  for (const [k, profile] of Object.entries(users)) {
    const j = await signUp(`${k.toLowerCase()}-${RUN}@t.com`);
    tok[k] = j;
    await db.doc(`users/${j.localId}`).set({ uid: j.localId, ...profile });
  }
  for (const t of [TA, TB]) await db.doc(`tenants/${t}`).set({ slug: t, name: t, plan: 'free' });
});
test.after(async () => { if (srv) await srv.close(); });

test('A1. autenticação e papel: sem token 401; usuário comum e manager 403; /me informa o acesso', async () => {
  assert.strictEqual((await call(null, 'GET', '/clients')).status, 401);
  for (const who of ['userA', 'managerA']) {
    assert.strictEqual((await call(who, 'GET', '/clients')).status, 403, who);
    assert.strictEqual((await call(who, 'GET', '/me')).body.canUseVault, false);
  }
  const me = await call('adminA', 'GET', '/me');
  assert.deepStrictEqual({ role: me.body.role, tenantSlug: me.body.tenantSlug, canUseVault: me.body.canUseVault }, { role: 'admin', tenantSlug: TA, canUseVault: true });
  // admin não escolhe outro tenant; master escolhe
  assert.strictEqual((await call('adminA', 'GET', `/clients?tenant=${TB}`)).status, 403);
  assert.strictEqual((await call('adminA', 'GET', '/clients', undefined, { 'X-Tenant-Id': TB })).status, 403);
  assert.strictEqual((await call('boss', 'GET', `/clients?tenant=${TB}`)).status, 200);
  assert.strictEqual((await call('boss', 'GET', '/clients?tenant=../x')).status, 400);
  // master sem tenant no perfil usa o tenant padrão 'nexia'
  assert.strictEqual((await call('bossNoTenant', 'GET', '/me')).body.tenantSlug, 'nexia');
  assert.strictEqual((await call('bossNoTenant', 'GET', '/clients')).status, 200);
});

let ids = {};
test('A2. CRUD com ETag, If-Match, Execution ID e idempotência', async () => {
  const c = await call('adminA', 'POST', '/clients', { name: 'NEXIA', slug: 'nexia', status: 'active' });
  assert.strictEqual(c.status, 201, c.raw);
  assert.strictEqual(c.headers.etag, '"v1"');
  assert.match(c.headers['x-execution-id'], /^exec_[0-9a-f]{32}$/);
  assert.strictEqual(c.body.record.last_execution_id, c.headers['x-execution-id']);
  ids.client = c.body.record.id;

  const pBody = { client_id: ids.client, name: 'NEXIA OS', slug: 'nexia-os', type: 'saas', status: 'active' };
  const p1 = await call('adminA', 'POST', '/projects', pBody, { 'Idempotency-Key': `proj-${RUN}` });
  const p2 = await call('adminA', 'POST', '/projects', pBody, { 'Idempotency-Key': `proj-${RUN}` });
  assert.deepStrictEqual([p1.status, p2.status, p2.body.replayed], [201, 200, true]);
  assert.strictEqual(p2.body.record.id, p1.body.record.id);
  ids.project = p1.body.record.id;

  const list = await call('adminA', 'GET', `/projects?client_id=${ids.client}`);
  assert.deepStrictEqual(list.body.items.map(p => p.id), [ids.project]);
  const got = await call('adminA', 'GET', `/projects/${ids.project}`);
  assert.strictEqual(got.headers.etag, '"v1"');

  assert.strictEqual((await call('adminA', 'PATCH', `/projects/${ids.project}`, { status: 'maintenance' })).status, 428);
  const conflict = await call('adminA', 'PATCH', `/projects/${ids.project}`, { status: 'maintenance' }, { 'If-Match': '"v9"' });
  assert.deepStrictEqual([conflict.status, conflict.body.code], [412, 'VERSION_CONFLICT']);
  const ok = await call('adminA', 'PATCH', `/projects/${ids.project}`, { status: 'maintenance' }, { 'If-Match': '"v1"' });
  assert.deepStrictEqual([ok.status, ok.body.record.status, ok.headers.etag], [200, 'maintenance', '"v2"']);

  const dup = await call('adminA', 'POST', '/clients', { name: 'Outro', slug: 'nexia', status: 'active' });
  assert.deepStrictEqual([dup.status, dup.body.code], [409, 'UNIQUE']);
  const bad = await call('adminA', 'POST', '/projects', { ...pBody, slug: 'x y', autonomy_level: 9 });
  assert.strictEqual(bad.status, 400);
  assert.ok(bad.body.details.issues.length >= 2);
  const hist = await call('adminA', 'GET', `/projects/${ids.project}/history`);
  assert.deepStrictEqual(hist.body.items.map(h => h.operation), ['create', 'update']);
});

test('A3. Environment: secret rejeitado (422) sem ecoar o valor; nomes de variável aceitos', async () => {
  const s = fakeSecrets();
  const r = await call('adminA', 'POST', '/environments', { project_id: ids.project, name: 'production', provider: 'render',
    notes: `chave ${s.groq_key}` });
  assert.deepStrictEqual([r.status, r.body.code], [422, 'SECRET_DETECTED']);
  assert.ok(!r.raw.includes(s.groq_key));
  const ok = await call('adminA', 'POST', '/environments', { project_id: ids.project, name: 'staging', provider: 'render',
    secret_refs: [{ name: 'GROQ_API_KEY', store: 'render' }] });
  assert.strictEqual(ok.status, 201, ok.raw);
  ids.staging = ok.body.record.id;
});

test('A4. soft-delete e restore pela API; dependentes bloqueiam (409)', async () => {
  const blocked = await call('adminA', 'DELETE', `/projects/${ids.project}`, undefined, { 'If-Match': '"v2"' });
  assert.deepStrictEqual([blocked.status, blocked.body.code], [409, 'HAS_DEPENDENTS']);
  const del = await call('adminA', 'DELETE', `/environments/${ids.staging}`, undefined, { 'If-Match': '"v1"' });
  assert.strictEqual(del.status, 200);
  assert.ok(del.body.record.deleted_at);
  assert.strictEqual((await call('adminA', 'GET', `/environments/${ids.staging}`)).status, 404);
  const back = await call('adminA', 'POST', `/environments/${ids.staging}/restore`, undefined, { 'If-Match': '"v2"' });
  assert.deepStrictEqual([back.status, back.body.record.deleted_at], [200, null]);
});

test('A5. isolamento: admin do tenant B não vê nem altera registros do tenant A', async () => {
  assert.strictEqual((await call('adminB', 'GET', `/projects/${ids.project}`)).status, 404);
  assert.strictEqual((await call('adminB', 'PATCH', `/projects/${ids.project}`, { status: 'paused' }, { 'If-Match': '"v2"' })).status, 404);
  assert.deepStrictEqual((await call('adminB', 'GET', '/projects')).body.items, []);
  assert.strictEqual((await call('boss', 'GET', `/projects/${ids.project}?tenant=${TA}`)).status, 200);
});

test('A6. onboarding (módulo, fonte local = este repositório): repo, ambiente, docs, snapshot; repetição sem duplicar', async () => {
  const vault = createVault({ db });
  const ctx = createExecutionContext({ tenantId: TA, actor: { type: 'user', id: 'gilcambe' } });
  const { record: repo } = await vault.Repository.create(ctx, { project_id: ids.project, provider: 'github', owner: 'gilcambe', repo: 'nexia',
    default_branch: 'develop', url: 'https://github.com/gilcambe/nexia' });
  const src = createLocalSource(path.join(__dirname, '..', '..'));
  const r1 = await onboardProject({ vault, ctx, projectId: ids.project, source: src, repositoryId: repo.id });
  const snap = r1.snapshot;
  assert.strictEqual(snap.repository_id, repo.id);
  assert.strictEqual(snap.default_branch, 'develop');
  assert.strictEqual(snap.deploy_target, 'cloudflare'); // ADR-HOST-01: wrangler.jsonc, sem Render
  assert.strictEqual(snap.firebase_project, 'nexia-c8710');
  assert.ok(snap.stack.includes('node') && snap.frameworks.includes('vite'));
  assert.strictEqual(snap.commands.build, 'npm run build');
  assert.deepStrictEqual(r1.environments.created.length, 1);
  const prod = await vault.Environment.get(ctx, r1.environments.created[0]);
  assert.deepStrictEqual([prod.name, prod.provider, prod.urls], ['production', 'cloudflare', []]);
  assert.ok(prod.secret_refs.some(s => s.name === 'GROQ_API_KEY' && s.store === 'cloudflare'));
  assert.ok(snap.environment_ids.includes(prod.id) && snap.environment_ids.includes(ids.staging));
  const docs = await vault.Artifact.list(ctx, { where: { project_id: ids.project }, limit: 200 });
  assert.ok(docs.some(a => a.uri === 'ARCHITECTURE-DECISIONS.md'));
  assert.deepStrictEqual(r1.steps.find(s => s.step === 'smoke_tests').result, 'not_run');
  assert.strictEqual((await vault.Project.get(ctx, ids.project)).primary_repository_id, repo.id);

  const r2 = await onboardProject({ vault, ctx: createExecutionContext({ tenantId: TA, actor: { type: 'user', id: 'gilcambe' } }),
    projectId: ids.project, source: src, repositoryId: repo.id });
  assert.deepStrictEqual(r2.environments, { created: [], existing: [prod.id] });
  assert.strictEqual((await vault.Artifact.list(ctx, { where: { project_id: ids.project }, limit: 200 })).length, docs.length);
  assert.notStrictEqual(r2.snapshot.id, snap.id);
  const latest = await call('adminA', 'GET', `/projects/${ids.project}/snapshot`);
  assert.strictEqual(latest.body.record.id, r2.snapshot.id);
  // todas as escritas da 1ª execução carregam o mesmo Execution ID
  const audits = (await db.collection('vault_audit').where('execution_id', '==', ctx.executionId).get()).docs.map(d => d.data());
  assert.ok(audits.length >= 4 && audits.every(a => a.actor.id === 'gilcambe'));
});

// CI: token efêmero do Actions (somente leitura) em NEXIA_TEST_GITHUB_TOKEN, usado só durante este teste.
const githubReachable = !!(process.env.NEXIA_TEST_GITHUB_TOKEN || process.env.NODE_USE_ENV_PROXY);
test('A7. onboarding HTTP lendo gilcambe/nexia no GitHub (projeto real cadastrado com snapshot)',
  { skip: !githubReachable && !process.env.CI && 'sem acesso ao GitHub neste ambiente (defina NEXIA_TEST_GITHUB_TOKEN)' }, async () => {
    const previous = process.env.GITHUB_TOKEN;
    if (process.env.NEXIA_TEST_GITHUB_TOKEN) process.env.GITHUB_TOKEN = process.env.NEXIA_TEST_GITHUB_TOKEN;
    try {
    const c = await call('adminB', 'POST', '/clients', { name: 'NEXIA', slug: 'nexia', status: 'active' });
    const p = await call('adminB', 'POST', '/projects', { client_id: c.body.record.id, name: 'NEXIA OS', slug: 'nexia-os', type: 'saas', status: 'active' });
    const r = await call('adminB', 'POST', `/projects/${p.body.record.id}/onboard`, { repository: { owner: 'gilcambe', repo: 'nexia' } });
    assert.strictEqual(r.status, 201, r.raw);
    assert.strictEqual(r.headers['x-execution-id'], r.body.execution_id);
    const repo = (await call('adminB', 'GET', `/repos/${r.body.repository_id}`)).body.record;
    assert.deepStrictEqual([repo.owner, repo.repo, repo.default_branch, repo.url], ['gilcambe', 'nexia', 'develop', 'https://github.com/gilcambe/nexia']);
    const snap = (await call('adminB', 'GET', `/projects/${p.body.record.id}/snapshot`)).body.record;
    // lê o develop do GitHub no momento do teste: 'render' antes do merge do ADR-HOST-01, 'cloudflare' depois
    assert.ok(['cloudflare', 'render'].includes(snap.deploy_target), snap.deploy_target);
    assert.strictEqual(snap.firebase_project, 'nexia-c8710');
    assert.ok(snap.stack.includes('node'));
    const bad = await call('adminB', 'POST', `/projects/${p.body.record.id}/onboard`, { repository: { owner: 'gilcambe', repo: 'nao-existe-' + RUN } });
    // GitHub direto (CI) responde 404; o proxy desta sessão de desenvolvimento responde 403 (→ 502).
    if (process.env.NODE_USE_ENV_PROXY) assert.ok([404, 502].includes(bad.status), String(bad.status));
    else assert.strictEqual(bad.status, 404);
    } finally {
      if (previous === undefined) delete process.env.GITHUB_TOKEN; else process.env.GITHUB_TOKEN = previous;
    }
  });
