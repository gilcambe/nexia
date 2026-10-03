'use strict';
// Fase 11: testes de aceitação do produto (spec §29, casos A a G), ponta a ponta no backend:
// Vault (emulador) + Project Resolver + Context Engine + Orchestrator + Tool Gateway + Policy
// Engine + GitHub falso em memória. O modelo é um roteiro de teste; nada sai da máquina e
// nenhum deploy real acontece (o "Actions" é o falso).
// Rodar com: npm run test:rules
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const crypto = require('crypto');
const { createVault, createExecutionContext } = require('../../nexia-ai/vault');
const { createGateway } = require('../../nexia-ai/tool-gateway');
const { createOrchestrator } = require('../../nexia-ai/orchestrator');
const { AGENTS } = require('../../nexia-ai/orchestrator/agents');
const { onboardProject } = require('../../nexia-ai/onboarding');
const { createLocalSource } = require('../../nexia-ai/onboarding/sources');
const { collectMetrics } = require('../../nexia-ai/observability');
const { createFakeGithub } = require('../fake-github');

const RUN = crypto.randomBytes(4).toString('hex');
const T = `acc-${RUN}`;
let db, vault, user, ids = {}, fake, failTrees = 0;
const state = {};

function router(script) {
  const q = Object.fromEntries(Object.entries(script).map(([k, v]) => [k, [...v]]));
  return {
    capabilities: () => ({ available: true, tool_call: true }),
    costEstimate: (d, u) => ({ known: true, usd: ((u.input_tokens || 0) * 3 + (u.output_tokens || 0) * 15) / 1e6 }),
    async toolCall(desc, req) {
      const agent = Object.keys(AGENTS).find(k => req.system.includes(AGENTS[k].prompt));
      const next = (q[agent] || []).shift();
      const r = typeof next === 'function' ? next(req) : next;
      return { usage: { input_tokens: 1000, output_tokens: 200 }, tool_calls: [], text: `${agent}: ok`, ...(r || {}) };
    },
  };
}
const call = (name, input) => ({ id: `tc_${crypto.randomBytes(3).toString('hex')}`, name: name.replace(/\./g, '__'), input });
const branchOf = req => /Branch de trabalho: (\S+)/.exec(req.messages[0].content)[1];
const report = { tool_calls: [{ id: 'r', name: 'report_findings', input: { verdict: 'approve', findings: [] } }] };
const GREEN = [{ name: 'Testes', status: 'completed', conclusion: 'success' }, { name: 'Build', status: 'completed', conclusion: 'success' },
  { name: 'gitleaks', status: 'completed', conclusion: 'success' }];

// GitHub falso com falha transitória opcional (502) na criação de tree do commit.
const fetchImpl = async (url, opts = {}) => {
  if (failTrees > 0 && opts.method === 'POST' && String(url).endsWith('/git/trees')) { failTrees--; return new Response('{}', { status: 502 }); }
  return fake.fetchImpl(url, opts);
};
const gateway = () => createGateway({ db, vault, env: fake.env, fetchImpl });
const orch = script => createOrchestrator({ vault, gateway: gateway(), router: router(script) });
const ctxOf = () => createExecutionContext({ tenantId: T, actor: { type: 'user', id: 'gilcambe' } });
const setAutonomy = async level => vault.Project.update(user, ids.agenda, { autonomy_level: level }, { expectedVersion: (await vault.Project.get(user, ids.agenda)).version });
const approve = async id => gateway().approve(user, id, { expectedVersion: (await vault.ToolCall.get(user, id)).version });
async function ask(o, message, extra = {}) {
  const ctx = ctxOf();
  const s = await o.start(ctx, { message, ...extra });
  if (!s.execution) return { s };
  return { s, ctx, exe: await o.run(ctx, s.execution.id) };
}

test.before(async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'rode via `npm run test:rules` (emuladores)');
  ({ db } = require('../../netlify/functions/firebase-init'));
  vault = createVault({ db });
  fake = createFakeGithub();
  await db.doc(`tenants/${T}`).set({ slug: T, name: T, plan: 'free' });
  user = ctxOf();
  const mk = async (e, d) => (await vault[e].create(user, d)).record.id;
  ids.alfa = await mk('Client', { name: 'Clínica Alfa', slug: 'clinica-alfa', status: 'active' });
  ids.agenda = await mk('Project', { client_id: ids.alfa, name: 'Agenda Online', slug: 'agenda-online', type: 'web_app', status: 'active' });
  await mk('Repository', { project_id: ids.agenda, provider: 'github', owner: 'gilcambe', repo: 'nexia', default_branch: 'develop', url: 'https://github.com/gilcambe/nexia' });
  await mk('Environment', { project_id: ids.agenda, name: 'staging', provider: 'firebase', urls: ['https://staging.agenda.example.com'], branch: 'develop' });
  await mk('Environment', { project_id: ids.agenda, name: 'production', provider: 'firebase', urls: ['https://agenda.example.com'], branch: 'develop' });
  ids.beta = await mk('Client', { name: 'Beta', slug: 'beta', status: 'active' });
  ids.loja = await mk('Project', { client_id: ids.beta, name: 'Loja', slug: 'loja', type: 'website', status: 'active' });
  ids.app = await mk('Project', { client_id: ids.beta, name: 'Aplicativo', slug: 'aplicativo', type: 'mobile_app', status: 'active' });
});

test('A. cliente conhecido: só o nome do cliente e a tarefa; projeto identificado sem perguntar', async () => {
  const { s, exe } = await ask(orch({ architect: [{ text: 'Nenhuma tarefa pendente registrada no Vault.' }] }), 'Na Clínica Alfa, quais tarefas estão pendentes?');
  assert.ok(s.execution, `não deveria perguntar: ${s.question}`);
  assert.strictEqual(exe.project_id, ids.agenda);
  assert.ok(s.resolution.confidence >= 0.7, JSON.stringify(s.resolution));
  assert.deepStrictEqual([exe.status, exe.intent], ['succeeded', 'status']);
});

test('B. cliente ambíguo: dois projetos possíveis; pergunta antes de editar e não cria execução', async () => {
  const before = (await vault.Execution.list(user, { limit: 200 })).length;
  const { s } = await ask(orch({}), 'Corrija o rodapé da Beta');
  assert.strictEqual(s.status, 'needs_input');
  assert.deepStrictEqual(s.candidates.map(c => c.project_id).sort(), [ids.app, ids.loja].sort());
  assert.strictEqual((await vault.Execution.list(user, { limit: 200 })).length, before);
  assert.strictEqual(fake.pulls.length, 0);
});

test('C. correção simples: edita, testa (CI), revisa, registra e entrega com evidência', async () => {
  await setAutonomy(3);
  const o = orch({
    architect: [{ text: 'Trocar o texto do botão em src/app.js.' }],
    frontend: [req => ({ tool_calls: [call('github.commit_files', { branch: branchOf(req), message: 'Corrige texto do botão', files: [{ path: 'src/app.js', content: 'console.log(2);\n' }] })] }), { text: 'Commit feito.' }],
    reviewer: [report], security: [report],
  });
  const { ctx, exe } = await ask(o, 'Na Clínica Alfa, corrija o texto do botão de confirmar');
  assert.strictEqual(exe.status, 'running', 'aguarda o CI');
  fake.checks.set(exe.work_branch, GREEN);
  const done = await o.refresh(ctx, exe.id);
  assert.strictEqual(done.status, 'succeeded', JSON.stringify(done.gates));
  assert.strictEqual(fake.fileAt(exe.work_branch, 'src/app.js'), 'console.log(2);\n');
  assert.ok(done.pull_request && fake.pulls.at(-1).draft);
  const calls = await vault.ToolCall.list(user, { where: { project_id: ids.agenda }, limit: 200 });
  assert.ok(done.plan.flatMap(s => s.tool_call_ids).every(id => calls.some(c => c.id === id)), 'cada passo aponta ToolCalls do Vault');
  state.changeBranch = exe.work_branch;
});

test('E. projeto novo: onboarding cria snapshot e integrações (pendentes, sem credencial)', async () => {
  const ctx = ctxOf();
  const cid = (await vault.Client.create(ctx, { name: 'Cliente Novo', slug: 'cliente-novo', status: 'active' })).record.id;
  const pid = (await vault.Project.create(ctx, { client_id: cid, name: 'Portal Novo', slug: 'portal-novo', type: 'web_app', status: 'planning' })).record.id;
  const { record: repo } = await vault.Repository.create(ctx, { project_id: pid, provider: 'github', owner: 'gilcambe', repo: `nexia-${RUN}`, default_branch: 'develop', url: `https://github.com/gilcambe/nexia-${RUN}` });
  const r = await onboardProject({ vault, ctx, projectId: pid, source: createLocalSource(path.join(__dirname, '..', '..')), repositoryId: repo.id });
  assert.strictEqual(r.snapshot.project_id, pid);
  const ints = await vault.Integration.list(ctx, { where: { project_id: pid }, limit: 50 });
  assert.deepStrictEqual(ints.map(i => [i.provider, i.status]).sort(), [['firebase', 'pending'], ['github', 'pending']]);
  assert.strictEqual(ints.find(i => i.provider === 'firebase').external_ref, 'nexia-c8710');
  assert.ok(ints.every(i => !i.secret_refs.length), 'nenhuma credencial inventada');
  const again = await onboardProject({ vault, ctx, projectId: pid, source: createLocalSource(path.join(__dirname, '..', '..')), repositoryId: repo.id });
  assert.deepStrictEqual([again.integrations.created.length, again.integrations.existing.length], [0, 2], 'repetição não duplica');
});

test('F. falha: erro transitório é repetido com segurança; falha real não vira sucesso', async () => {
  failTrees = 1;
  const o = orch({
    architect: [{ text: 'x' }],
    coder: [req => ({ tool_calls: [call('github.commit_files', { branch: branchOf(req), message: 'Ajusta', files: [{ path: 'README.md', content: '# ajuste\n' }] })] }), { text: 'ok' }],
    reviewer: [report], security: [report],
  });
  const { ctx, exe } = await ask(o, 'Na Clínica Alfa, ajuste o README');
  assert.strictEqual(failTrees, 0, 'a falha aconteceu');
  assert.strictEqual(exe.status, 'running', `${exe.error_code}: ${exe.result_summary}`);
  const commits = (await vault.ToolCall.list(user, { where: { project_id: ids.agenda }, limit: 200 })).filter(c => exe.plan[2].tool_call_ids.includes(c.id) && c.tool === 'github.commit_files');
  assert.deepStrictEqual(commits.map(c => c.status).sort(), ['failed', 'succeeded'], 'uma tentativa falhou (UPSTREAM) e a repetição passou');
  fake.checks.set(exe.work_branch, [{ ...GREEN[0], conclusion: 'failure' }, GREEN[1], GREEN[2]]);
  const after = await o.refresh(ctx, exe.id);
  assert.strictEqual(after.status, 'failed');
  assert.match(after.result_summary, /Não concluído: falhou unit tests/);
  assert.ok(after.finished_at);
});

test('G1. produção sem o commit em staging: mesmo aprovada, não dispara', async () => {
  fake.branches.set('develop', fake.branches.get(state.changeBranch)); // "merge" do PR do caso C
  fake.checks.set('develop', GREEN);
  await setAutonomy(5);
  const o = orch({});
  const { ctx, exe } = await ask(o, 'Na Clínica Alfa, publique em produção');
  assert.deepStrictEqual([exe.intent, exe.status], ['deploy_production', 'waiting_approval'], 'nível 5 também pede pessoa');
  await approve(exe.plan[1].tool_call_ids.at(-1));
  const after = await o.resume(ctx, exe.id);
  assert.deepStrictEqual([after.status, after.plan[1].error_code], ['failed', 'STAGING_REQUIRED']);
  assert.strictEqual(fake.dispatches.length, 0);
});

test('D. deploy: sem comandos manuais; dispara o pipeline autorizado, acompanha e confirma', async () => {
  await setAutonomy(4);
  const o = orch({});
  const { ctx, exe } = await ask(o, 'Na Clínica Alfa, publique em staging');
  assert.deepStrictEqual(fake.dispatches.map(d => d.inputs.target), ['staging']);
  assert.strictEqual(exe.status, 'running');
  Object.assign(fake.runs.at(-1), { status: 'completed', conclusion: 'success', updated_at: new Date().toISOString() });
  const done = await o.refresh(ctx, exe.id);
  assert.strictEqual(done.status, 'succeeded', JSON.stringify(done.gates));
  assert.match(done.result_summary, /deployment dpl_/);
  assert.ok(!/npm |firebase deploy|wrangler /.test(done.result_summary), 'nenhum comando manual pedido ao usuário');
});

test('G2. produção: política exige aprovação humana; depois dela, só o commit validado vai ao ar', async () => {
  await setAutonomy(5);
  const o = orch({});
  const { ctx, exe } = await ask(o, 'Na Clínica Alfa, publique em produção');
  assert.strictEqual(exe.status, 'waiting_approval');
  assert.strictEqual(fake.dispatches.length, 1, 'nada antes da aprovação');
  const agentTry = await gateway().invoke(createExecutionContext({ tenantId: T, actor: { type: 'agent', id: 'devops' } }), { projectId: ids.agenda, tool: 'deploy.production', input: {} });
  assert.strictEqual(agentTry.status, 'pending_approval', 'agente não executa produção direto');
  await gateway().reject(user, agentTry.tool_call.id, { expectedVersion: agentTry.tool_call.version });
  await approve(exe.plan[1].tool_call_ids.at(-1));
  const after = await o.resume(ctx, exe.id);
  assert.deepStrictEqual(fake.dispatches.map(d => d.inputs.target), ['staging', 'production']);
  Object.assign(fake.runs.at(-1), { status: 'completed', conclusion: 'success', updated_at: new Date().toISOString() });
  const done = await o.refresh(ctx, after.id);
  assert.strictEqual(done.status, 'succeeded', JSON.stringify(done.gates));
  assert.deepStrictEqual(done.gates.filter(g => g.gate >= 9).map(g => g.status), ['passed', 'passed', 'passed']);
});

test('Observabilidade: custos, ferramentas, aprovações e deploys do projeto vêm do Vault', async () => {
  const m = await collectMetrics({ vault, ctx: user, projectId: ids.agenda });
  assert.ok(m.executions.total >= 6);
  assert.ok(m.executions.cost_usd > 0 && m.executions.cost_unknown === 0);
  assert.ok(m.executions.by_status.succeeded >= 3 && m.executions.by_status.failed >= 2);
  assert.ok(m.tools['github.commit_files'].failed >= 1 && m.tools['deploy.production'].risk === 'CRITICAL');
  assert.ok(m.approvals.approved >= 2 && m.approvals.rejected >= 1);
  assert.deepStrictEqual(m.deployments.by_environment.production.last.approved_by, 'gilcambe');
  assert.strictEqual(m.deployments.by_environment.production.by_status.succeeded, 1);
});
