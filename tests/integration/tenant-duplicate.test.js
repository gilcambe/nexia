'use strict';
// ADR-CLONE-01: POST /api/nexia/tenants/:id/duplicate contra o servidor real e os emuladores de Auth e Firestore.
// Só master; prévia (dry_run) não grava; a cópia leva configuração com ids novos e referências remapeadas e
// nunca leva segredos, membros, execuções, auditoria, cobrança ou dados pessoais. Com a fila ligada
// (Worker grátis), a API só cria o tenant "queued" e o runner do Actions termina.
// Rodar com: npm run test:rules
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { rawRequest, startServer } = require('../helpers');
const { createVault, createExecutionContext } = require('../../nexia-ai/vault');
const { createHandler } = require('../../nexia-ai/api');
const { runJob } = require('../../nexia-ai/jobs/runner');

const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const RUN = crypto.randomBytes(4).toString('hex');
const SRC = `dup-src-${RUN}`;
const DST = `dup-dst-${RUN}`;
let srv, db, vault;
const tok = {};
const ids = {};

async function signUp(email) {
  const r = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'senha-forte-123', returnSecureToken: true }),
  });
  const j = await r.json();
  if (!j.idToken) throw new Error('signUp falhou');
  return j;
}

async function call(who, method, p, body) {
  const r = await rawRequest(srv.port, `/api/nexia${p}`, {
    method, body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...(who ? { Authorization: `Bearer ${tok[who].idToken}` } : {}) },
  });
  let json = null;
  try { json = JSON.parse(r.body); } catch { /* corpo vazio */ }
  return { status: r.status, body: json, raw: r.body };
}

test.before(async () => {
  assert.ok(AUTH && process.env.FIRESTORE_EMULATOR_HOST, 'rode via `npm run test:rules` (emuladores)');
  ({ db } = require('../../netlify/functions/firebase-init'));
  vault = createVault({ db });
  srv = await startServer();
  for (const [k, profile] of Object.entries({ boss: { role: 'master', tenantSlug: 'nexia' }, adminSrc: { role: 'admin', tenantSlug: SRC } })) {
    const j = await signUp(`${k.toLowerCase()}-${RUN}@t.com`);
    tok[k] = j;
    await db.doc(`users/${j.localId}`).set({ uid: j.localId, ...profile });
  }
  await db.doc(`tenants/${SRC}`).set({ slug: SRC, name: 'Origem', ownerUid: 'u-dono', ownerEmail: 'dono@origem.com', plan: 'pro', billing: { status: 'active', customerId: 'cus_9' },
    settings: { language: 'pt-BR', timezone: 'America/Sao_Paulo', webhookUrl: 'https://hooks.example/x' }, theme: { primary: '#123456' } });
  await db.doc(`tenants/${SRC}/config/brand`).set({ color: '#ff0000', supportEmail: 'oi@origem.com' });
  await db.doc(`tenants/${SRC}/members/u-dono`).set({ uid: 'u-dono', email: 'dono@origem.com', role: 'admin' });
  await db.doc(`tenants/${SRC}/leads/l1`).set({ nome: 'Fulano', email: 'f@x.com' });
  const ctx = createExecutionContext({ tenantId: SRC, actor: { type: 'user', id: 'seed' } });
  const mk = async (e, d) => (await vault[e].create(ctx, d)).record;
  ids.client = (await mk('Client', { name: 'Cliente A', slug: 'cliente-a', status: 'active', contacts: [{ name: 'Maria Souza', role: 'CEO' }] })).id;
  ids.project = (await mk('Project', { client_id: ids.client, name: 'Site A', slug: 'site-a', type: 'website', status: 'active', autonomy_level: 2 })).id;
  ids.repo = (await mk('Repository', { project_id: ids.project, provider: 'github', owner: 'gilcambe', repo: `dup-${RUN}`, default_branch: 'develop', url: 'https://github.com/gilcambe/nexia' })).id;
  const p = await vault.Project.get(ctx, ids.project);
  await vault.Project.update(ctx, ids.project, { primary_repository_id: ids.repo }, { expectedVersion: p.version });
  await mk('Environment', { project_id: ids.project, name: 'production', provider: 'cloudflare', urls: ['https://a.example.com'], branch: 'develop',
    secret_refs: [{ name: 'NEXIA_CLOUDFLARE_A_TOKEN', store: 'github_actions' }] });
  await mk('ToolPolicy', { project_id: ids.project, rules: [{ tool: 'github.*', decision: 'confirm' }] });
  await mk('Execution', { project_id: ids.project, execution_id: ctx.executionId, requested_by: { type: 'user', id: 'seed' }, request_summary: 'x', intent: 'question',
    status: 'planned', started_at: new Date().toISOString() });
});
test.after(async () => { if (srv) await srv.close(); });

test('TD-I1. só master; validação; prévia (dry_run) mostra o plano e não grava nada', async () => {
  assert.strictEqual((await call(null, 'POST', `/tenants/${SRC}/duplicate`, { new_tenant: DST })).status, 401);
  assert.strictEqual((await call('adminSrc', 'POST', `/tenants/${SRC}/duplicate`, { new_tenant: DST })).status, 403, 'admin do próprio tenant não duplica');
  assert.strictEqual((await call('boss', 'GET', `/tenants/${SRC}/duplicate`)).status, 405);
  assert.strictEqual((await call('boss', 'POST', `/tenants/${SRC}/duplicate`, { new_tenant: SRC })).status, 400);
  assert.strictEqual((await call('boss', 'POST', `/tenants/${SRC}/duplicate`, { new_tenant: 'X Y' })).status, 400);
  assert.strictEqual((await call('boss', 'POST', `/tenants/${SRC}/duplicate`, { new_tenant: DST, include: ['users'] })).status, 400);
  assert.strictEqual((await call('boss', 'POST', `/tenants/nao-existe-${RUN}/duplicate`, { new_tenant: DST })).status, 404);
  const dry = await call('boss', 'POST', `/tenants/${SRC}/duplicate`, { new_tenant: DST, name: 'Destino', dry_run: true });
  assert.strictEqual(dry.status, 200, dry.raw);
  assert.strictEqual(dry.body.dry_run, true);
  assert.deepStrictEqual(dry.body.counts, { clients: 1, projects: 1, repositories: 1, environments: 1, 'tool-policies': 1 });
  assert.ok(dry.body.omitted_fields.includes('Environment.secret_refs') && dry.body.omitted_fields.includes('settings.webhookUrl'));
  assert.strictEqual((await db.doc(`tenants/${DST}`).get()).exists, false, 'prévia não grava');
});

test('TD-I2. cópia: ids novos, referências remapeadas, auditoria; nada de segredo, pessoas, execuções, cobrança ou dados pessoais', async () => {
  const r = await call('boss', 'POST', `/tenants/${SRC}/duplicate`, { new_tenant: DST, name: 'Destino' });
  assert.strictEqual(r.status, 201, r.raw);
  assert.deepStrictEqual(r.body.created, { config: 1, modules: 0, robots: 0, clients: 1, projects: 1, repositories: 1, environments: 1, 'tool-policies': 1 });
  const t = (await db.doc(`tenants/${DST}`).get()).data();
  assert.deepStrictEqual([t.name, t.plan, t.status, t.duplicatedFrom, t.duplicationStatus, t.settings, t.theme], ['Destino', 'free', 'active', SRC, 'done',
    { language: 'pt-BR', timezone: 'America/Sao_Paulo' }, { primary: '#123456' }]);
  for (const k of ['ownerUid', 'ownerEmail', 'billing', 'planLimits']) assert.strictEqual(t[k], undefined, k);
  assert.deepStrictEqual((await db.doc(`tenants/${DST}/config/brand`).get()).data().color, '#ff0000');
  assert.strictEqual((await db.doc(`tenants/${DST}/config/brand`).get()).data().supportEmail, undefined);
  assert.strictEqual((await db.collection(`tenants/${DST}/members`).get()).size, 0, 'membros não são copiados');
  assert.strictEqual((await db.collection(`tenants/${DST}/leads`).get()).size, 0, 'dados pessoais não são copiados');

  const ctx = createExecutionContext({ tenantId: DST, actor: { type: 'user', id: 'check' } });
  const [cl] = await vault.Client.list(ctx);
  const [pr] = await vault.Project.list(ctx);
  const [rp] = await vault.Repository.list(ctx);
  const [en] = await vault.Environment.list(ctx);
  const [po] = await vault.ToolPolicy.list(ctx);
  assert.ok(cl.id !== ids.client && pr.id !== ids.project && rp.id !== ids.repo, 'ids novos');
  assert.deepStrictEqual([pr.client_id, pr.primary_repository_id, rp.project_id, en.project_id, po.project_id], [cl.id, rp.id, pr.id, pr.id, pr.id], 'referências remapeadas');
  assert.deepStrictEqual([cl.contacts, en.secret_refs, en.urls, pr.autonomy_level], [[], [], ['https://a.example.com'], 2]);
  assert.strictEqual(r.body.id_map[ids.project], pr.id);
  assert.strictEqual((await vault.Execution.list(ctx)).length, 0, 'execuções não são copiadas');
  const audit = await db.collection('vault_audit').where('tenant_id', '==', DST).where('operation', '==', 'duplicate_create').get();
  assert.strictEqual(audit.size, 1);
  assert.deepStrictEqual([audit.docs[0].data().source_tenant, audit.docs[0].data().actor.type], [SRC, 'user']);
  assert.ok(!JSON.stringify(audit.docs[0].data()).includes('Cliente A'), 'auditoria sem valores');
  assert.strictEqual((await db.collection('vault_audit').where('tenant_id', '==', SRC).where('operation', '==', 'duplicate_source').get()).size, 1);
  assert.strictEqual((await call('boss', 'POST', `/tenants/${SRC}/duplicate`, { new_tenant: DST })).status, 409, 'destino já existe');
});

test('TD-I3. com a fila ligada (Worker grátis): API cria o tenant "queued" e enfileira só ids; o runner do Actions copia', async () => {
  const dst = `${DST}-fila`;
  const sent = [];
  const h = createHandler({ db, verify: async () => ({ ok: true, uid: 'boss-uid', role: 'master', tenantSlug: 'nexia' }),
    jobs: { enabled: true, dispatch: async job => { sent.push(job); return { queued: true, kind: job.kind }; } } });
  const res = await h({ httpMethod: 'POST', path: `/api/nexia/tenants/${SRC}/duplicate`, headers: {}, body: JSON.stringify({ new_tenant: dst, include: ['repositories'] }) });
  assert.strictEqual(res.statusCode, 202, res.body);
  const body = JSON.parse(res.body);
  assert.deepStrictEqual([body.queued, body.job.queued, body.include], [true, true, ['clients', 'projects', 'repositories']]);
  assert.deepStrictEqual(sent, [{ kind: 'tenant.duplicate', tenant: SRC, actor: { type: 'user', id: 'boss-uid' }, target: dst }]);
  assert.strictEqual((await db.doc(`tenants/${dst}`).get()).data().duplicationStatus, 'queued');
  const again = await h({ httpMethod: 'POST', path: `/api/nexia/tenants/${SRC}/duplicate`, headers: {}, body: JSON.stringify({ new_tenant: dst }) });
  assert.deepStrictEqual([again.statusCode, JSON.parse(again.body).requeued, sent.length], [202, true, 2], 'repetir só reenfileira');
  const out = await runJob(sent[0], { db });
  assert.deepStrictEqual(out.created, { clients: 1, projects: 1, repositories: 1 });
  assert.strictEqual((await db.doc(`tenants/${dst}`).get()).data().duplicationStatus, 'done');
  await assert.rejects(runJob(sent[0], { db }), e => e.code === 'VALIDATION', 'a mesma tarefa não roda duas vezes');
});
