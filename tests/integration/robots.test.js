'use strict';
// ADR-AUTO-01: Robôs NEXIA ponta a ponta contra o Vault (emulador), o Tool Gateway real, o
// GitHub falso e um modelo roteirizado. API (CRUD, "rodar agora", tenant), Cron do Worker e a
// tarefa robots.run do Actions (reivindicação atômica: nunca roda o mesmo horário duas vezes).
// Rodar com: npm run test:rules
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { createVault, createExecutionContext } = require('../../nexia-ai/vault');
const { createGateway } = require('../../nexia-ai/tool-gateway');
const { createOrchestrator } = require('../../nexia-ai/orchestrator');
const { AGENTS } = require('../../nexia-ai/orchestrator/agents');
const { validateJob, scheduledSweep } = require('../../nexia-ai/jobs');
const { runDueRobots, findDueRobots } = require('../../nexia-ai/robots');
const { createFakeGithub } = require('../fake-github');

const RUN = crypto.randomBytes(4).toString('hex');
const T = `rob-${RUN}`;
const OWNER = `dono-${RUN}`;
let db, vault, fake, ids = {};

// Modelo de teste: o Architect responde sempre a mesma coisa (pedido de status, só leitura).
const router = () => ({
  capabilities: d => ({ available: d.provider === 'anthropic', tool_call: true }),
  costEstimate: () => ({ known: true, usd: 0 }),
  async chat(desc, req) { return this.toolCall(desc, { ...req, tools: [] }); },
  async toolCall(desc, req) {
    const agent = Object.keys(AGENTS).find(k => req.system.includes(AGENTS[k].prompt));
    return { text: `${agent}: o Site Alfa tem develop e main.`, tool_calls: [], usage: { input_tokens: 10, output_tokens: 5 } };
  },
});
const orch = () => createOrchestrator({ vault, gateway: createGateway({ db, vault, env: fake.env, fetchImpl: fake.fetchImpl }), router: router() });

const queued = [];
const fakeJobs = { enabled: true, dispatch: async j => { queued.push(validateJob(j)); return { queued: true, kind: j.kind }; } };
function mkApi({ role = 'admin', tenantSlug = T, uid = OWNER } = {}) {
  const { createHandler } = require('../../nexia-ai/api');
  const h = createHandler({ db, jobs: fakeJobs, verify: async () => ({ ok: true, uid, role, tenantSlug }),
    gateway: { env: fake.env, fetchImpl: fake.fetchImpl }, router: router(), background: () => { throw new Error('com a fila ligada nada roda na API'); } });
  return async (method, path, body, headers = {}) => {
    const u = new URL(`http://x${path}`);
    const r = await h({ httpMethod: method, path: u.pathname, headers: { 'content-type': 'application/json', ...headers },
      queryStringParameters: Object.fromEntries(u.searchParams), body: body ? JSON.stringify(body) : null });
    return { status: r.statusCode, body: JSON.parse(r.body) };
  };
}

test.before(async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'rode via `npm run test:rules` (emuladores)');
  ({ db } = require('../../netlify/functions/firebase-init'));
  vault = createVault({ db });
  fake = createFakeGithub();
  await db.doc(`tenants/${T}`).set({ slug: T, name: T, plan: 'free' });
  const ctx = createExecutionContext({ tenantId: T, actor: { type: 'user', id: OWNER } });
  const mk = async (e, d) => (await vault[e].create(ctx, d)).record.id;
  ids.client = await mk('Client', { name: 'Alfa', slug: 'alfa', status: 'active' });
  ids.project = await mk('Project', { client_id: ids.client, name: 'Site Alfa', slug: 'site-alfa', type: 'website', status: 'active' });
  await mk('Repository', { project_id: ids.project, provider: 'github', owner: 'gilcambe', repo: 'nexia', default_branch: 'develop', url: 'https://github.com/gilcambe/nexia' });
});

test('RB1. API: cria (dono e próximo horário pelo servidor), lista, modelos, edita, desliga; tenant isolado', async () => {
  const api = mkApi();
  const tpl = await api('GET', '/api/nexia/robots/templates');
  assert.deepStrictEqual([tpl.status, tpl.body.items.length], [200, 3]);
  const before = Date.now();
  const c = await api('POST', '/api/nexia/robots', { project_id: ids.project, name: 'Relatório', task: 'Quais branches o Site Alfa tem?',
    schedule: { kind: 'daily', time: '08:00' }, enabled: true, owner: { type: 'user', id: 'intruso' }, next_run_at: '2020-01-01T00:00:00.000Z' });
  assert.strictEqual(c.status, 201, JSON.stringify(c.body));
  const r = c.body.record;
  assert.deepStrictEqual([r.owner, r.timezone, r.enabled, r.recent_runs], [{ type: 'user', id: OWNER }, 'America/Sao_Paulo', true, []]);
  const nextMs = Date.parse(r.next_run_at);
  assert.ok(nextMs > before && nextMs - before <= 24 * 3600e3, 'próximo 08:00 de Brasília nas próximas 24 h');
  assert.strictEqual(new Date(nextMs).getUTCHours(), 11);
  ids.robot = r.id;

  const bad = await api('POST', '/api/nexia/robots', { project_id: ids.project, name: 'X', task: 't', schedule: { kind: 'daily', time: '25:00' }, enabled: true });
  assert.strictEqual(bad.status, 400);
  assert.strictEqual((await api('POST', '/api/nexia/robots', { project_id: 'prj_' + '0'.repeat(32), name: 'X', task: 't', schedule: { kind: 'hourly' }, enabled: true })).status, 422);

  const list = await api('GET', `/api/nexia/robots?project_id=${ids.project}`);
  assert.deepStrictEqual(list.body.items.map(x => x.id), [r.id]);
  assert.strictEqual((await api('PATCH', `/api/nexia/robots/${r.id}`, { name: 'Novo' })).status, 428, 'If-Match obrigatório');
  const renamed = await api('PATCH', `/api/nexia/robots/${r.id}`, { name: 'Relatório diário' }, { 'If-Match': `"v${r.version}"` });
  assert.deepStrictEqual([renamed.status, renamed.body.record.next_run_at], [200, r.next_run_at], 'mudar o nome não mexe na agenda');
  const off = await api('PATCH', `/api/nexia/robots/${r.id}`, { enabled: false }, { 'If-Match': `"v${renamed.body.record.version}"` });
  assert.deepStrictEqual([off.status, off.body.record.enabled, off.body.record.next_run_at], [200, false, undefined]);
  const on = await api('PATCH', `/api/nexia/robots/${r.id}`, { enabled: true, schedule: { kind: 'hourly', minute: 5 } }, { 'If-Match': `"v${off.body.record.version}"` });
  assert.strictEqual(new Date(on.body.record.next_run_at).getUTCMinutes(), 5);
  const own = await api('PATCH', `/api/nexia/robots/${r.id}`, { owner: { type: 'user', id: 'outro' } }, { 'If-Match': `"v${on.body.record.version}"` });
  assert.strictEqual(own.status, 400, 'nada para atualizar: o dono não muda pela tela');

  assert.strictEqual((await mkApi({ tenantSlug: 'outro-tenant' })('GET', `/api/nexia/robots?tenant=${T}`)).status, 403);
  assert.strictEqual((await mkApi({ role: 'user' })('GET', '/api/nexia/robots')).status, 403);
  assert.strictEqual((await mkApi({ role: 'master', tenantSlug: 'nexia', uid: 'chefe' })('GET', `/api/nexia/robots/${r.id}`)).status, 404, 'master no tenant padrão não vê robô de outro tenant');
  assert.strictEqual((await mkApi({ role: 'master', tenantSlug: 'nexia', uid: 'chefe' })('GET', `/api/nexia/robots/${r.id}?tenant=${T}`)).status, 200);
});

test('RB2. "Rodar agora": cria a execução e enfileira só ids; a rodada aparece no robô', async () => {
  const api = mkApi();
  queued.length = 0;
  const r = await api('POST', `/api/nexia/robots/${ids.robot}/run`);
  assert.strictEqual(r.status, 202, JSON.stringify(r.body));
  assert.deepStrictEqual([r.body.execution.status, r.body.execution.project_id, r.body.execution.requested_by], ['planned', ids.project, { type: 'user', id: OWNER }]);
  assert.deepStrictEqual(r.body.job, { queued: true, kind: 'execution.run' });
  assert.deepStrictEqual(Object.keys(queued[0]).sort(), ['actor', 'ctx_id', 'id', 'kind', 'tenant']);
  assert.ok(!JSON.stringify(queued[0]).includes('Site Alfa'), 'a tarefa leva só ids');
  const got = (await api('GET', `/api/nexia/robots/${ids.robot}`)).body.record;
  assert.deepStrictEqual([got.recent_runs[0].trigger, got.recent_runs[0].execution_id, got.last_run_execution_id], ['manual', r.body.execution.id, r.body.execution.id]);
  assert.strictEqual(got.next_run_at, (await api('GET', `/api/nexia/robots/${ids.robot}`)).body.record.next_run_at, 'agenda intacta');
});

test('RB3. Cron + robots.run: dispara só com robô vencido; reivindicação atômica (duas tarefas, uma rodada); roda em nome do dono', async () => {
  const sys = createExecutionContext({ tenantId: T, actor: { type: 'system', id: 'teste' } });
  const robot = await vault.Robot.get(sys, ids.robot);
  const slot = Date.parse(robot.next_run_at);
  const sent = [];
  const jobs = { enabled: true, dispatch: async j => { sent.push(validateJob(j)); return { queued: true }; } };
  // Antes do horário: o robô não está vencido.
  assert.ok(!(await findDueRobots(db, slot - 1000)).some(x => x.id === ids.robot));
  const later = slot + 60e3;
  const out = await scheduledSweep({ db, jobs, now: () => later });
  assert.ok(out.robots >= 1 && out.robots_queued, JSON.stringify(out));
  assert.deepStrictEqual(sent.filter(j => j.kind === 'robots.run'), [{ kind: 'robots.run' }]);

  // Duas tarefas ao mesmo tempo (o Cron disparou de novo antes da primeira reivindicar).
  const { runJob } = require('../../nexia-ai/jobs/runner');
  const [a, b] = await Promise.all([runJob({ kind: 'robots.run' }, { db, orchestrator: orch(), now: () => later }),
    runJob({ kind: 'robots.run' }, { db, orchestrator: orch(), now: () => later })]);
  assert.strictEqual(a.started + b.started, 1, JSON.stringify([a, b]));
  assert.deepStrictEqual(Object.keys(a).sort(), ['claimed', 'due', 'kind', 'started'], 'resumo só com contagens');

  const after = await vault.Robot.get(sys, ids.robot);
  assert.ok(Date.parse(after.next_run_at) > later, 'agenda avançou');
  assert.strictEqual(after.last_run_at, new Date(later).toISOString());
  const run = after.recent_runs.find(x => x.trigger === 'schedule');
  assert.deepStrictEqual([run.status, run.execution_id], ['succeeded', after.last_run_execution_id]);
  const exe = await vault.Execution.get(sys, run.execution_id);
  assert.deepStrictEqual([exe.requested_by, exe.project_id, exe.status], [{ type: 'user', id: OWNER }, ids.project, 'succeeded']);
  assert.match(exe.result_summary || '', /develop e main/);

  // Mesmo instante de novo: nada vencido, nada roda.
  const again = await runDueRobots({ db, vault, orchestrator: orch(), now: () => later });
  assert.strictEqual(again.started, 0);
  const total = (await vault.Execution.list(sys, { where: { project_id: ids.project }, limit: 200 })).length;
  assert.strictEqual(total, 2, 'uma manual (RB2) + uma agendada');
});

test('RB4. excluir: desliga e faz soft-delete; o Cron não vê mais o robô', async () => {
  const api = mkApi();
  const cur = (await api('GET', `/api/nexia/robots/${ids.robot}`)).body.record;
  const del = await api('DELETE', `/api/nexia/robots/${ids.robot}`, null, { 'If-Match': `"v${cur.version}"` });
  assert.strictEqual(del.status, 200, JSON.stringify(del.body));
  assert.deepStrictEqual([del.body.record.enabled, del.body.record.next_run_at, !!del.body.record.deleted_at], [false, undefined, true]);
  const far = Date.parse(cur.next_run_at) + 30 * 24 * 3600e3;
  assert.ok(!(await findDueRobots(db, far)).some(x => x.id === ids.robot));
  assert.strictEqual((await api('GET', `/api/nexia/robots/${ids.robot}`)).status, 404);
  const hist = await api('GET', `/api/nexia/robots/${ids.robot}/history`);
  assert.ok(hist.body.items.some(x => x.actor.type === 'system' && x.actor.id === 'robots'), 'reivindicação auditada como sistema');
  assert.strictEqual(hist.body.items.at(-1).operation, 'soft_delete');
});
