'use strict';
// Fase 6: Tool Gateway + Policy Engine no emulador.
// Projeto real: NEXIA OS (gilcambe/nexia). Ferramentas iniciais só de leitura (vault.*,
// github.get_repo, github.get_checks); uma ferramenta MEDIUM de teste (grava uma Task)
// exercita a fila de aprovação. Rodar com: npm run test:rules
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { initializeTestEnvironment, assertFails } = require('@firebase/rules-unit-testing');
const { createVault, createExecutionContext } = require('../../nexia-ai/vault');
const { createGateway, DEFAULT_TOOLS, QUEUE_COLLECTION } = require('../../nexia-ai/tool-gateway');
const { createHandler } = require('../../nexia-ai/api');

const RUN = crypto.randomBytes(4).toString('hex');
const T = `tools-${RUN}`;
const SHA = crypto.randomBytes(20).toString('hex');
let db, vault, user, agent, ids = {};
let clock = new Date('2026-10-02T16:00:00.000Z');
let runs = 0;

// Ferramenta MEDIUM de teste: cria uma Task no projeto (escrita real no Vault).
const writeTask = {
  name: 'test.create_task', risk: 'MEDIUM', description: 'Cria uma tarefa (teste da fila de aprovação).',
  input_schema: { type: 'object', required: ['title'], properties: { title: { type: 'string' } } },
  summarizeInput: i => `título "${i.title.slice(0, 40)}"`,
  async run({ vault: v, ctx, project }, i) { runs++; return (await v.Task.create(ctx, { project_id: project.id, title: i.title, priority: 'low', status: 'todo' })).record; },
  summarizeOutput: r => `Task ${r.id.slice(0, 10)}… criada`,
};

const fakeGithub = { calls: [], checks: [{ name: 'Secret scan', status: 'completed', conclusion: 'success' }, { name: 'Typecheck, testes e build', status: 'completed', conclusion: 'failure' }] };
const fetchImpl = async (url, opts) => {
  fakeGithub.calls.push({ url, auth: !!(opts.headers && opts.headers.Authorization) });
  const ok = body => ({ ok: true, status: 200, json: async () => body });
  if (/\/repos\/gilcambe\/nexia$/.test(url)) return ok({ full_name: 'gilcambe/nexia', default_branch: 'develop', private: false, archived: false, open_issues_count: 3, pushed_at: '2026-10-02T15:00:00Z', html_url: 'https://github.com/gilcambe/nexia' });
  if (/\/repos\/gilcambe\/nexia\/commits\/[^/]+\/check-runs/.test(url)) return ok({ total_count: fakeGithub.checks.length, check_runs: fakeGithub.checks });
  return { ok: false, status: 404, json: async () => ({}) };
};
const gw = (extra = {}) => createGateway({ db, vault, tools: [...DEFAULT_TOOLS, writeTask], env: {}, fetchImpl, now: () => clock, ...extra });

test.before(async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'rode via `npm run test:rules` (emuladores)');
  ({ db } = require('../../netlify/functions/firebase-init'));
  vault = createVault({ db });
  await db.doc(`tenants/${T}`).set({ slug: T, name: T, plan: 'free' });
  user = createExecutionContext({ tenantId: T, actor: { type: 'user', id: 'gilcambe' } });
  agent = createExecutionContext({ tenantId: T, actor: { type: 'agent', id: 'qa' } });
  const mk = async (e, d) => (await vault[e].create(user, d)).record.id;
  ids.client = await mk('Client', { name: 'NEXIA', slug: 'nexia', status: 'active' });
  ids.project = await mk('Project', { client_id: ids.client, name: 'NEXIA OS', slug: 'nexia-os', type: 'saas', status: 'active' });
  ids.repo = await mk('Repository', { project_id: ids.project, provider: 'github', owner: 'gilcambe', repo: 'nexia', default_branch: 'develop', url: 'https://github.com/gilcambe/nexia' });
  ids.task = await mk('Task', { project_id: ids.project, title: 'Ligar o Tool Gateway', priority: 'high', status: 'in_progress' });
  ids.other = await mk('Project', { client_id: ids.client, name: 'CES Check-in', slug: 'ces-checkin', type: 'web_app', status: 'active' });
  ids.otherTask = await mk('Task', { project_id: ids.other, title: 'Tarefa de outro projeto', priority: 'low', status: 'todo' });
});

test('G1. LOW automático: vault.list executa na hora e fica registrado no Vault', async () => {
  const r = await gw().invoke(agent, { projectId: ids.project, tool: 'vault.list', input: { entity: 'Task', status: 'in_progress' } });
  assert.strictEqual(r.status, 'succeeded');
  assert.deepStrictEqual(r.result.items.map(x => x.id), [ids.task]);
  const c = await vault.ToolCall.get(user, r.tool_call.id);
  assert.deepStrictEqual([c.tool, c.risk, c.decision, c.status, c.requested_by.type, c.decided_by.id], ['vault.list', 'LOW', 'auto', 'succeeded', 'agent', 'policy-engine']);
  assert.strictEqual(c.output_summary, 'Task: 1 registro(s)');
  assert.strictEqual(c.execution_id, agent.executionId);
  assert.match(c.input_sha256, /^[0-9a-f]{64}$/);
  assert.ok(c.duration_ms >= 0);
});

test('G2. escopo e validação: registro de outro projeto falha com SCOPE; entrada inválida e ferramenta desconhecida não executam', async () => {
  const r = await gw().invoke(agent, { projectId: ids.project, tool: 'vault.get', input: { entity: 'Task', id: ids.otherTask } });
  assert.deepStrictEqual([r.status, r.error.code], ['failed', 'SCOPE']);
  assert.strictEqual((await vault.ToolCall.get(user, r.tool_call.id)).error_code, 'SCOPE');
  await assert.rejects(gw().invoke(agent, { projectId: ids.project, tool: 'vault.list', input: { entity: 'Task', owner: 'x' } }), e => e.code === 'INVALID_INPUT' && e.details.problems.includes('$.owner: campo não permitido'));
  await assert.rejects(gw().invoke(agent, { projectId: ids.project, tool: 'vault.list', input: { entity: 'Client' } }), e => e.code === 'INVALID_INPUT');
  await assert.rejects(gw().invoke(agent, { projectId: ids.project, tool: 'shell.exec', input: {} }), e => e.code === 'UNKNOWN_TOOL');
});

test('G3. MEDIUM na autonomia 0: fila de aprovação; agente não aprova; versão evita execução dupla', async () => {
  runs = 0;
  const g = gw();
  const r = await g.invoke(agent, { projectId: ids.project, tool: 'test.create_task', input: { title: 'Criar workflow de CI' } });
  assert.strictEqual(r.status, 'pending_approval');
  assert.strictEqual(runs, 0);
  assert.strictEqual(r.tool_call.input_summary, 'título "Criar workflow de CI"');
  assert.ok((await db.collection(QUEUE_COLLECTION).doc(r.tool_call.id).get()).exists);
  assert.deepStrictEqual((await g.pending(user, { projectId: ids.project })).map(c => c.id), [r.tool_call.id]);
  await assert.rejects(g.approve(agent, r.tool_call.id, { expectedVersion: 1 }), e => e.code === 'FORBIDDEN');
  await assert.rejects(g.approve(user, r.tool_call.id, { expectedVersion: 9 }), e => e.code === 'VERSION_CONFLICT');
  const a = await g.approve(user, r.tool_call.id, { expectedVersion: 1 });
  assert.strictEqual(a.status, 'succeeded');
  assert.strictEqual(runs, 1);
  assert.strictEqual((await vault.Task.get(user, a.result.id)).title, 'Criar workflow de CI');
  assert.deepStrictEqual([a.tool_call.decided_by.id, a.tool_call.status], ['gilcambe', 'succeeded']);
  await assert.rejects(g.approve(user, r.tool_call.id, { expectedVersion: a.tool_call.version }), e => e.code === 'NOT_PENDING');
  assert.strictEqual(runs, 1);
  assert.ok(!(await db.collection(QUEUE_COLLECTION).doc(r.tool_call.id).get()).exists);
  const hist = await vault.ToolCall.history(user, r.tool_call.id);
  assert.deepStrictEqual(hist.map(h => h.operation), ['create', 'update', 'update']);
});

test('G4. rejeição e expiração: nada executa', async () => {
  runs = 0;
  const g = gw({ approvalTtlMs: 60 * 60 * 1000 });
  const r1 = await g.invoke(agent, { projectId: ids.project, tool: 'test.create_task', input: { title: 'Rejeitar' } });
  const rej = await g.reject(user, r1.tool_call.id, { expectedVersion: 1 });
  assert.deepStrictEqual([rej.status, rej.tool_call.error_code], ['rejected', 'REJECTED']);
  const r2 = await g.invoke(agent, { projectId: ids.project, tool: 'test.create_task', input: { title: 'Expirar' } });
  clock = new Date(clock.getTime() + 2 * 60 * 60 * 1000);
  await assert.rejects(g.approve(user, r2.tool_call.id, { expectedVersion: 1 }), e => e.code === 'EXPIRED');
  assert.strictEqual((await vault.ToolCall.get(user, r2.tool_call.id)).status, 'expired');
  assert.strictEqual(runs, 0);
});

test('G5. política do projeto: forbidden nega na hora; política alterada antes da aprovação impede a execução', async () => {
  runs = 0;
  const g = gw();
  const pending = await g.invoke(agent, { projectId: ids.project, tool: 'test.create_task', input: { title: 'Antes da política' } });
  const { record: pol } = await vault.ToolPolicy.create(user, { project_id: ids.project, rules: [{ tool: 'test.*', decision: 'forbidden' }, { tool: 'vault.*', decision: 'confirm' }] });
  const denied = await g.invoke(agent, { projectId: ids.project, tool: 'test.create_task', input: { title: 'Proibida' } });
  assert.deepStrictEqual([denied.status, denied.tool_call.decision, denied.tool_call.status], ['denied', 'forbidden', 'denied']);
  const confirm = await g.invoke(agent, { projectId: ids.project, tool: 'vault.get', input: { entity: 'Project', id: ids.project } });
  assert.strictEqual(confirm.status, 'pending_approval', 'política endurece até ferramenta LOW');
  const a = await g.approve(user, pending.tool_call.id, { expectedVersion: 1 });
  assert.deepStrictEqual([a.status, a.tool_call.error_code], ['rejected', 'POLICY_FORBIDDEN']);
  assert.strictEqual(runs, 0);
  await g.reject(user, confirm.tool_call.id, { expectedVersion: 1 });
  await vault.ToolPolicy.softDelete(user, pol.id, { expectedVersion: pol.version });
});

test('G6. idempotência: a mesma chave não executa duas vezes', async () => {
  runs = 0;
  const g = gw();
  await vault.Project.update(user, ids.project, { autonomy_level: 1 }, { expectedVersion: (await vault.Project.get(user, ids.project)).version });
  const key = `tool-${RUN}-idem`;
  const a = await g.invoke(agent, { projectId: ids.project, tool: 'test.create_task', input: { title: 'Uma vez só' }, idempotencyKey: key });
  const b = await g.invoke(agent, { projectId: ids.project, tool: 'test.create_task', input: { title: 'Uma vez só' }, idempotencyKey: key });
  assert.deepStrictEqual([a.status, b.replayed, b.tool_call.id, runs], ['succeeded', true, a.tool_call.id, 1]);
});

test('G7. GitHub: só o repositório do projeto; SHA encurtado no registro; checks resumidos', async () => {
  fakeGithub.calls = [];
  const g = gw();
  const repo = await g.invoke(agent, { projectId: ids.project, tool: 'github.get_repo', input: {} });
  assert.deepStrictEqual([repo.status, repo.result.full_name, repo.result.visibility], ['succeeded', 'gilcambe/nexia', 'public']);
  const checks = await g.invoke(agent, { projectId: ids.project, tool: 'github.get_checks', input: { ref: SHA } });
  assert.deepStrictEqual(checks.result.by_conclusion, { success: 1, failure: 1 });
  assert.strictEqual(fakeGithub.calls[1].url, `https://api.github.com/repos/gilcambe/nexia/commits/${SHA}/check-runs?per_page=100`);
  assert.strictEqual(fakeGithub.calls[1].auth, false, 'sem GITHUB_TOKEN no ambiente, sem Authorization');
  const c = await vault.ToolCall.get(user, checks.tool_call.id);
  assert.strictEqual(c.input_summary, `ref ${SHA.slice(0, 7)}…`);
  assert.strictEqual(c.output_summary, 'gilcambe/nexia: 2 check(s) (success 1, failure 1)');
  const other = await g.invoke(agent, { projectId: ids.other, tool: 'github.get_repo', input: { repository_id: ids.repo } });
  assert.deepStrictEqual([other.status, other.error.code], ['failed', 'SCOPE']);
  const bad = await g.invoke(agent, { projectId: ids.project, tool: 'github.get_checks', input: { ref: '../../etc' } });
  assert.deepStrictEqual([bad.status, bad.error.code], ['failed', 'INVALID_INPUT']);
});

test('G8. HTTP /api/nexia: tools, invoke, approvals e tool-calls; usuário comum barrado', async () => {
  let who = 'admin';
  const handler = createHandler({ db, verify: async () => ({ ok: true, uid: `u-${RUN}`, role: who, tenantSlug: T }), gateway: { tools: [...DEFAULT_TOOLS, writeTask], env: {}, fetchImpl } });
  const call = async (method, p, body, headers = {}) => {
    const u = new URL(`http://x${p}`);
    const r = await handler({ httpMethod: method, path: u.pathname, headers: { 'content-type': 'application/json', ...headers }, queryStringParameters: Object.fromEntries(u.searchParams), body: body ? JSON.stringify(body) : null });
    return { status: r.statusCode, headers: r.headers, body: JSON.parse(r.body || 'null') };
  };
  const list = await call('GET', '/api/nexia/tools');
  assert.strictEqual(list.status, 200);
  assert.deepStrictEqual(list.body.items.map(t => `${t.name}:${t.risk}`).slice(0, 6), ['vault.get:LOW', 'vault.list:LOW', 'vault.history:LOW', 'vault.context:LOW', 'github.get_repo:LOW', 'github.get_checks:LOW']);
  const ok = await call('POST', '/api/nexia/tools/invoke', { project_id: ids.project, tool: 'vault.get', input: { entity: 'Project', id: ids.project } });
  assert.deepStrictEqual([ok.status, ok.body.status, ok.body.result.id], [200, 'succeeded', ids.project]);
  await vault.Project.update(user, ids.project, { autonomy_level: 0 }, { expectedVersion: (await vault.Project.get(user, ids.project)).version });
  const pend = await call('POST', '/api/nexia/tools/invoke', { project_id: ids.project, tool: 'test.create_task', input: { title: 'Via HTTP' } });
  assert.deepStrictEqual([pend.status, pend.body.status, pend.headers.ETag], [202, 'pending_approval', '"v1"']);
  const queue = await call('GET', `/api/nexia/approvals?project_id=${ids.project}`);
  assert.deepStrictEqual(queue.body.items.map(c => c.id), [pend.body.tool_call.id]);
  assert.strictEqual((await call('POST', `/api/nexia/approvals/${pend.body.tool_call.id}/approve`)).status, 428);
  const ap = await call('POST', `/api/nexia/approvals/${pend.body.tool_call.id}/approve`, null, { 'if-match': '"v1"' });
  assert.deepStrictEqual([ap.status, ap.body.status], [200, 'succeeded']);
  const again = await call('POST', `/api/nexia/approvals/${pend.body.tool_call.id}/approve`, null, { 'if-match': `"v${ap.body.tool_call.version}"` });
  assert.deepStrictEqual([again.status, again.body.code], [409, 'NOT_PENDING']);
  const bad = await call('POST', '/api/nexia/tools/invoke', { project_id: ids.project, tool: 'vault.list', input: { entity: 'Task', x: 1 } });
  assert.deepStrictEqual([bad.status, bad.body.code], [400, 'INVALID_INPUT']);
  const calls = await call('GET', `/api/nexia/tool-calls?project_id=${ids.project}`);
  assert.ok(calls.body.items.length >= 10);
  assert.strictEqual((await call('POST', '/api/nexia/tool-calls', {})).status, 404, 'o log não aceita escrita pela API');
  who = 'user';
  assert.strictEqual((await call('GET', '/api/nexia/tools')).status, 403);
  assert.strictEqual((await call('GET', '/api/nexia/approvals')).status, 403);
});

test('G9. regras: a fila (entrada completa) é inacessível a clientes; o log segue a regra vault_*', async () => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  const env = await initializeTestEnvironment({ projectId: process.env.GCLOUD_PROJECT || 'demo-nexia',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', '..', 'firestore.rules'), 'utf8'), host, port: Number(port) } });
  try {
    await db.doc(`users/admin-${RUN}`).set({ uid: `admin-${RUN}`, role: 'admin', tenantSlug: T });
    const g = gw();
    const r = await g.invoke(agent, { projectId: ids.project, tool: 'test.create_task', input: { title: 'Fila' } });
    const client = env.authenticatedContext(`admin-${RUN}`).firestore();
    await assertFails(client.doc(`${QUEUE_COLLECTION}/${r.tool_call.id}`).get());
    await assertFails(client.doc(`vault_tool_calls/${r.tool_call.id}`).set({ status: 'succeeded' }));
    await g.reject(user, r.tool_call.id, { expectedVersion: 1 });
  } finally { await env.cleanup(); }
});

test('G10. GitHub real (gilcambe/nexia): get_repo e get_checks pelo gateway', { skip: !process.env.NEXIA_TEST_GITHUB_TOKEN && 'sem NEXIA_TEST_GITHUB_TOKEN' }, async () => {
  const g = createGateway({ db, vault, env: { GITHUB_TOKEN: process.env.NEXIA_TEST_GITHUB_TOKEN } });
  const repo = await g.invoke(agent, { projectId: ids.project, tool: 'github.get_repo', input: {} });
  assert.strictEqual(repo.status, 'succeeded', JSON.stringify(repo.error));
  assert.strictEqual(repo.result.full_name, 'gilcambe/nexia');
  const checks = await g.invoke(agent, { projectId: ids.project, tool: 'github.get_checks', input: { ref: 'develop' } });
  assert.strictEqual(checks.status, 'succeeded', JSON.stringify(checks.error));
  assert.ok(checks.result.total >= 1, `checks em develop: ${checks.result.total}`);
});
