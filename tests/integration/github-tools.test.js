'use strict';
// Fase 8: ferramentas do GitHub pelo Tool Gateway, com autonomia por projeto (spec §23):
// nível 0 só leitura, 2 branch + commit, 3 PR. Escrita contra o GitHub falso em memória;
// leitura também contra o GitHub real (gilcambe/nexia) quando há token de teste.
// Rodar com: npm run test:rules
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { createVault, createExecutionContext } = require('../../nexia-ai/vault');
const { createGateway, QUEUE_COLLECTION } = require('../../nexia-ai/tool-gateway');
const { createHandler } = require('../../nexia-ai/api');
const { createFakeGithub } = require('../fake-github');

const RUN = crypto.randomBytes(4).toString('hex');
const T = `gh-${RUN}`;
let db, vault, user, agent, ids = {}, fake;

const gw = () => createGateway({ db, vault, env: fake.env, fetchImpl: fake.fetchImpl });
const setAutonomy = async level => vault.Project.update(user, ids.project, { autonomy_level: level }, { expectedVersion: (await vault.Project.get(user, ids.project)).version });
const invoke = (tool, input, extra = {}) => gw().invoke(agent, { projectId: ids.project, tool, input, ...extra });
const approve = async id => gw().approve(user, id, { expectedVersion: (await vault.ToolCall.get(user, id)).version });

test.before(async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'rode via `npm run test:rules` (emuladores)');
  ({ db } = require('../../netlify/functions/firebase-init'));
  vault = createVault({ db });
  fake = createFakeGithub();
  await db.doc(`tenants/${T}`).set({ slug: T, name: T, plan: 'free' });
  user = createExecutionContext({ tenantId: T, actor: { type: 'user', id: 'gilcambe' } });
  agent = createExecutionContext({ tenantId: T, actor: { type: 'agent', id: 'coder' } });
  const mk = async (e, d) => (await vault[e].create(user, d)).record.id;
  ids.client = await mk('Client', { name: 'NEXIA', slug: 'nexia', status: 'active' });
  ids.project = await mk('Project', { client_id: ids.client, name: 'NEXIA OS', slug: 'nexia-os', type: 'saas', status: 'active' });
  ids.repo = await mk('Repository', { project_id: ids.project, provider: 'github', owner: 'gilcambe', repo: 'nexia', default_branch: 'develop', url: 'https://github.com/gilcambe/nexia' });
});

test('GH1. autonomia 0: leitura roda; criar branch e commit vão para aprovação e só executam com pessoa', async () => {
  await setAutonomy(0);
  const br = await invoke('github.list_branches', {});
  assert.deepStrictEqual([br.status, br.result.branches.map(b => b.name).sort()], ['succeeded', ['develop', 'main']]);
  const create = await invoke('github.create_branch', { branch: 'nexia/gh1' });
  assert.strictEqual(create.status, 'pending_approval');
  assert.match(create.reason, /exige autonomia 2/);
  assert.ok(!fake.branches.has('nexia/gh1'), 'nada executou antes da aprovação');
  const ok = await approve(create.tool_call.id);
  assert.deepStrictEqual([ok.status, ok.result.branch], ['succeeded', 'nexia/gh1']);
  assert.ok(fake.branches.has('nexia/gh1'));
});

test('GH2. autonomia 2: branch e commit automáticos; PR ainda pede pessoa; conteúdo do commit não vai para o Vault', async () => {
  await setAutonomy(2);
  const b = await invoke('github.create_branch', { branch: 'nexia/gh2' });
  assert.strictEqual(b.status, 'succeeded', JSON.stringify(b.error));
  const marker = `conteudo-${RUN}`;
  const c = await invoke('github.commit_files', { branch: 'nexia/gh2', message: 'Corrige formulário', files: [{ path: 'src/app.js', content: `// ${marker}\n` }] });
  assert.strictEqual(c.status, 'succeeded', JSON.stringify(c.error));
  assert.strictEqual(fake.fileAt('nexia/gh2', 'src/app.js'), `// ${marker}\n`);
  const rec = await vault.ToolCall.get(user, c.tool_call.id);
  assert.deepStrictEqual([rec.risk, rec.decision], ['HIGH', 'auto']);
  assert.strictEqual(rec.input_summary, 'commit em nexia/gh2: 1 arquivo(s) (src/app.js)');
  assert.ok(!JSON.stringify(rec).includes(marker), 'conteúdo fica fora do Vault');
  const pr = await invoke('github.create_pr', { head: 'nexia/gh2', title: 'Corrige formulário' });
  assert.strictEqual(pr.status, 'pending_approval');
  const q = (await db.collection(QUEUE_COLLECTION).doc(pr.tool_call.id).get()).data();
  assert.strictEqual(q.input.head, 'nexia/gh2', 'entrada completa só na fila do servidor');
  const done = await approve(pr.tool_call.id);
  assert.deepStrictEqual([done.status, done.result.draft, done.result.base], ['succeeded', true, 'develop']);
});

test('GH2b. edit_files: troca trechos exatos num commit; trecho ausente ou repetido falha sem commit', async () => {
  await setAutonomy(2);
  await invoke('github.create_branch', { branch: 'nexia/gh2b' });
  await invoke('github.commit_files', { branch: 'nexia/gh2b', message: 'base', files: [{ path: 'src/a.js', content: 'const a = 1;\nconst b = 1;\n' }] });
  const ok = await invoke('github.edit_files', { branch: 'nexia/gh2b', message: 'Ajusta a', edits: [{ path: 'src/a.js', find: 'const a = 1;', replace: 'const a = 2;' }] });
  assert.strictEqual(ok.status, 'succeeded', JSON.stringify(ok.error));
  assert.strictEqual(fake.fileAt('nexia/gh2b', 'src/a.js'), 'const a = 2;\nconst b = 1;\n');
  const head = fake.branches.get('nexia/gh2b');
  for (const find of ['const', 'nao existe']) {
    const bad = await invoke('github.edit_files', { branch: 'nexia/gh2b', message: 'x', edits: [{ path: 'src/a.js', find, replace: 'y' }] });
    assert.strictEqual(bad.status, 'failed');
    assert.match(bad.error.message, /exatamente 1 vez/);
  }
  assert.strictEqual(fake.branches.get('nexia/gh2b'), head, 'nenhum commit nas falhas');
});

test('GH3. autonomia 3: PR e CI automáticos; deploy, branch padrão e arquivo sensível falham mesmo assim', async () => {
  await setAutonomy(3);
  await invoke('github.create_branch', { branch: 'nexia/gh3' });
  await invoke('github.commit_files', { branch: 'nexia/gh3', message: 'muda', files: [{ path: 'README.md', content: '# x\n' }] });
  const pr = await invoke('github.create_pr', { head: 'nexia/gh3', title: 'GH3' });
  assert.strictEqual(pr.status, 'succeeded', JSON.stringify(pr.error));
  const ci = await invoke('github.dispatch_workflow', { workflow: 'ci.yml', ref: 'nexia/gh3' });
  assert.strictEqual(ci.status, 'succeeded', JSON.stringify(ci.error));
  const cases = [
    ['github.dispatch_workflow', { workflow: 'deploy.yml' }, 'FORBIDDEN'],
    ['github.commit_files', { branch: 'develop', message: 'x', files: [{ path: 'a', content: 'b' }] }, 'FORBIDDEN'],
    ['github.commit_files', { branch: 'nexia/gh3', message: 'x', files: [{ path: '.env', content: 'A=1' }] }, 'SENSITIVE_FILE'],
    ['github.get_file', { path: '.env' }, 'SENSITIVE_FILE'],
  ];
  for (const [tool, input, code] of cases) {
    const r = await invoke(tool, input);
    assert.deepStrictEqual([r.status, r.error && r.error.code], ['failed', code], tool);
    assert.strictEqual((await vault.ToolCall.get(user, r.tool_call.id)).error_code, code);
  }
});

test('GH4. produção e política do projeto: escrita em production sempre pede pessoa; regra forbidden bloqueia', async () => {
  await setAutonomy(3);
  const prod = await invoke('github.create_branch', { branch: 'nexia/gh4' }, { environment: 'production' });
  assert.strictEqual(prod.status, 'pending_approval');
  const { record: pol } = await vault.ToolPolicy.create(user, { project_id: ids.project, rules: [{ tool: 'github.commit_files', decision: 'forbidden' }] });
  const r = await invoke('github.commit_files', { branch: 'nexia/gh1', message: 'x', files: [{ path: 'a.txt', content: 'b' }] });
  assert.strictEqual(r.status, 'denied');
  await vault.ToolPolicy.softDelete(user, pol.id, { expectedVersion: pol.version });
});

test('GH5. sem GitHub App: escrita falha com GITHUB_APP_REQUIRED; leitura continua', async () => {
  await setAutonomy(3);
  const g = createGateway({ db, vault, env: { GITHUB_TOKEN: 'legado' }, fetchImpl: fake.fetchImpl });
  const w = await g.invoke(agent, { projectId: ids.project, tool: 'github.create_branch', input: { branch: 'nexia/gh5' } });
  assert.deepStrictEqual([w.status, w.error.code], ['failed', 'GITHUB_APP_REQUIRED']);
  const r = await g.invoke(agent, { projectId: ids.project, tool: 'github.get_file', input: { path: 'README.md' } });
  assert.deepStrictEqual([r.status, r.result.content], ['succeeded', '# nexia\n']);
});

test('GH6. catálogo: risco e autonomia mínima de cada ferramenta do GitHub em /api/nexia/tools', async () => {
  const handler = createHandler({ db, verify: async () => ({ ok: true, uid: `u-${RUN}`, role: 'admin', tenantSlug: T }), gateway: { env: fake.env, fetchImpl: fake.fetchImpl } });
  const r = await handler({ httpMethod: 'GET', path: '/api/nexia/tools', headers: {}, queryStringParameters: {} });
  assert.strictEqual(r.statusCode, 200, r.body);
  const tools = Object.fromEntries(JSON.parse(r.body).items.filter(t => t.name.startsWith('github.')).map(t => [t.name, `${t.risk}/${t.min_autonomy ?? '-'}`]));
  assert.deepStrictEqual(tools, {
    'github.get_repo': 'LOW/-', 'github.list_branches': 'LOW/-', 'github.get_file': 'LOW/-', 'github.compare': 'LOW/-', 'github.list_commits': 'LOW/-',
    'github.list_issues': 'LOW/-', 'github.list_pulls': 'LOW/-', 'github.get_checks': 'LOW/-', 'github.list_workflow_runs': 'LOW/-',
    'github.create_branch': 'MEDIUM/2', 'github.commit_files': 'HIGH/2', 'github.edit_files': 'HIGH/2', 'github.create_pr': 'HIGH/3', 'github.dispatch_workflow': 'HIGH/3',
  });
});

test('GH7. GitHub real (gilcambe/nexia): branches, arquivo, histórico, diff, PRs e Actions pelo gateway', { skip: !process.env.NEXIA_TEST_GITHUB_TOKEN && 'sem NEXIA_TEST_GITHUB_TOKEN' }, async () => {
  await setAutonomy(0);
  const g = createGateway({ db, vault, env: { GITHUB_TOKEN: process.env.NEXIA_TEST_GITHUB_TOKEN } });
  const run = async (tool, input) => {
    const r = await g.invoke(agent, { projectId: ids.project, tool, input });
    assert.strictEqual(r.status, 'succeeded', `${tool}: ${JSON.stringify(r.error)}`);
    return r.result;
  };
  assert.ok((await run('github.list_branches', {})).branches.some(b => b.name === 'develop'));
  const pkg = await run('github.get_file', { path: 'package.json', ref: 'develop' });
  assert.match(pkg.content, /"name"/);
  const commits = (await run('github.list_commits', { ref: 'develop', limit: 5 })).commits;
  assert.strictEqual(commits.length, 5);
  const diff = await run('github.compare', { base: commits[1].sha, head: commits[0].sha });
  assert.ok(diff.total_commits >= 1);
  assert.ok(Array.isArray((await run('github.list_pulls', { state: 'closed', limit: 5 })).pulls));
  assert.ok(Array.isArray((await run('github.list_workflow_runs', { branch: 'develop', limit: 5 })).runs));
  const w = await g.invoke(agent, { projectId: ids.project, tool: 'github.create_branch', input: { branch: 'nexia/nunca' } });
  assert.strictEqual(w.status, 'pending_approval', 'autonomia 0: escrita real nunca roda sozinha');
  await g.reject(user, w.tool_call.id, { expectedVersion: w.tool_call.version });
});
