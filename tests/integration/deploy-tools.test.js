'use strict';
// Fase 9: Firebase, Cloudflare, pipeline modelo e deploy de staging pelo Tool Gateway.
// GitHub, Google e Cloudflare falsos em memória (nada sai da máquina; nenhum deploy real).
// Rodar com: npm run test:rules
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { createVault, createExecutionContext } = require('../../nexia-ai/vault');
const { createGateway } = require('../../nexia-ai/tool-gateway');
const { createFakeGithub } = require('../fake-github');
const { createFakeGoogle, createFakeCloudflare, combineFetch } = require('../fake-cloud');

const RUN = crypto.randomBytes(4).toString('hex');
const T = `dep-${RUN}`;
const TAG = T.toUpperCase().replace(/-/g, '_');
let db, vault, user, agent, ids = {}, github, google, cloudflare, env;

const gw = (extraEnv = {}) => createGateway({ db, vault, env: { ...env, ...extraEnv }, fetchImpl: combineFetch({ github, google, cloudflare }) });
const invoke = (tool, input, o = {}) => gw(o.env).invoke(agent, { projectId: o.project || ids.project, tool, input });
const setAutonomy = async level => vault.Project.update(user, ids.project, { autonomy_level: level }, { expectedVersion: (await vault.Project.get(user, ids.project)).version });

test.before(async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'rode via `npm run test:rules` (emuladores)');
  ({ db } = require('../../netlify/functions/firebase-init'));
  vault = createVault({ db });
  github = createFakeGithub(); google = createFakeGoogle(); cloudflare = createFakeCloudflare();
  env = { ...github.env, [`NEXIA_FIREBASE_${TAG}_SA`]: google.serviceAccount, [`NEXIA_CLOUDFLARE_${TAG}_TOKEN`]: cloudflare.token, NEXIA_FIREBASE_NEXIA_SA: 'credencial-de-outro-tenant' };
  await db.doc(`tenants/${T}`).set({ slug: T, name: T, plan: 'free' });
  user = createExecutionContext({ tenantId: T, actor: { type: 'user', id: 'gilcambe' } });
  agent = createExecutionContext({ tenantId: T, actor: { type: 'agent', id: 'devops' } });
  const mk = async (e, d) => (await vault[e].create(user, d)).record.id;
  ids.client = await mk('Client', { name: 'Alfa', slug: 'alfa', status: 'active' });
  ids.project = await mk('Project', { client_id: ids.client, name: 'Site Alfa', slug: 'site-alfa', type: 'website', status: 'active' });
  ids.bare = await mk('Project', { client_id: ids.client, name: 'Sem integração', slug: 'sem-integracao', type: 'website', status: 'active' });
  await mk('Repository', { project_id: ids.project, provider: 'github', owner: 'gilcambe', repo: 'nexia', default_branch: 'develop', url: 'https://github.com/gilcambe/nexia' });
  await mk('Repository', { project_id: ids.bare, provider: 'github', owner: 'gilcambe', repo: 'outro', default_branch: 'main', url: 'https://github.com/gilcambe/outro' });
  ids.staging = await mk('Environment', { project_id: ids.project, name: 'staging', provider: 'firebase', urls: ['https://staging.alfa.com.br'], branch: 'develop' });
  ids.production = await mk('Environment', { project_id: ids.project, name: 'production', provider: 'firebase', urls: ['https://alfa.com.br'] });
  ids.fb = await mk('Integration', { project_id: ids.project, provider: 'firebase', status: 'active', external_ref: google.projectId, secret_refs: [{ name: `NEXIA_FIREBASE_${TAG}_SA`, store: 'env' }] });
  ids.cfPages = await mk('Integration', { project_id: ids.project, provider: 'cloudflare', status: 'active', external_ref: `pages:${cloudflare.account}:site-alfa`, secret_refs: [{ name: `NEXIA_CLOUDFLARE_${TAG}_TOKEN`, store: 'env' }] });
  ids.cfZone = await mk('Integration', { project_id: ids.project, provider: 'cloudflare', status: 'active', external_ref: `zone:${cloudflare.zone}`, secret_refs: [{ name: `NEXIA_CLOUDFLARE_${TAG}_TOKEN`, store: 'env' }] });
});

test('D1. Firebase e Cloudflare: leitura automática (LOW) só com integração do projeto; valor da credencial fora do Vault', async () => {
  const st = await invoke('firebase.get_status', {});
  assert.strictEqual(st.status, 'succeeded', JSON.stringify(st.error));
  assert.deepStrictEqual([st.result.hosting.used, st.result.functions.used], [true, false]);
  assert.strictEqual((await vault.ToolCall.get(user, st.tool_call.id)).output_summary, 'cliente-alfa: usa hosting, rules, firestore');
  const pages = await invoke('cloudflare.get_deployment_status', { integration_id: ids.cfPages });
  assert.deepStrictEqual([pages.status, pages.result.deployments.length], ['succeeded', 2]);
  const dns = await invoke('cloudflare.list_dns', { integration_id: ids.cfZone });
  assert.strictEqual(dns.result.records.length, 2);
  const ambiguous = await invoke('cloudflare.list_dns', {});
  assert.deepStrictEqual([ambiguous.status, ambiguous.error.code], ['failed', 'INVALID_INPUT'], 'duas integrações cloudflare: precisa dizer qual');
  const none = await invoke('firebase.get_project', {}, { project: ids.bare });
  assert.match(none.error.message, /não usa firebase/);
  const calls = await vault.ToolCall.list(user, { where: { project_id: ids.project }, limit: 50 });
  assert.ok(!JSON.stringify(calls).includes(cloudflare.token) && !JSON.stringify(calls).includes('PRIVATE KEY'));
});

test('D2. credencial de outro tenant ou ausente: nada é chamado', async () => {
  const { record: it } = await vault.Integration.create(user, { project_id: ids.bare, provider: 'firebase', status: 'active', external_ref: 'nexia-c8710', secret_refs: [{ name: 'NEXIA_FIREBASE_NEXIA_SA', store: 'env' }] });
  const before = google.calls.length;
  const r = await invoke('firebase.get_status', {}, { project: ids.bare });
  assert.deepStrictEqual([r.status, r.error.code], ['failed', 'SCOPE']);
  assert.strictEqual(google.calls.length, before, 'nenhuma chamada ao Google');
  await vault.Integration.update(user, it.id, { secret_refs: [{ name: `NEXIA_FIREBASE_${TAG}_OUTRA`, store: 'env' }] }, { expectedVersion: it.version });
  const missing = await invoke('firebase.get_status', {}, { project: ids.bare });
  assert.deepStrictEqual([missing.status, missing.error.code], ['failed', 'CREDENTIAL_MISSING']);
  // Nome longo de variável passa no Vault; valor com formato de chave continua recusado
  await assert.rejects(vault.Integration.create(user, { project_id: ids.bare, provider: 'cloudflare', status: 'active', external_ref: `zone:${cloudflare.zone}`,
    secret_refs: [{ name: ['AKIA', 'ABCDEFGHIJKLMNOP'].join(''), store: 'env' }] }), e => e.code === 'SECRET_DETECTED' || /secret/.test(e.message));
});

test('D3. pipeline modelo a partir do Vault e entrega por commit + PR (autonomia 3)', async () => {
  await setAutonomy(3);
  const p = await invoke('cicd.render_pipeline', { health_path: '/health' });
  assert.strictEqual(p.status, 'succeeded', JSON.stringify(p.error));
  assert.strictEqual(p.result.path, '.github/workflows/nexia-pipeline.yml');
  assert.match(p.result.content, /environment:\n\s+name: "production"\n\s+url: "https:\/\/alfa.com.br"/);
  assert.deepStrictEqual(p.result.warnings, []);
  await invoke('github.create_branch', { branch: 'nexia/pipeline' });
  const c = await invoke('github.commit_files', { branch: 'nexia/pipeline', message: 'Adiciona pipeline NEXIA', files: [{ path: p.result.path, content: p.result.content }] });
  assert.strictEqual(c.status, 'succeeded', JSON.stringify(c.error));
  assert.strictEqual(github.fileAt('nexia/pipeline', '.github/workflows/nexia-pipeline.yml'), p.result.content);
  const pr = await invoke('github.create_pr', { head: 'nexia/pipeline', title: 'Pipeline NEXIA' });
  assert.strictEqual(pr.status, 'succeeded');
});

test('D4. deploy.staging: nível 3 pede pessoa; nível 4 dispara o pipeline e registra o Deployment; dispatch genérico do pipeline é proibido', async () => {
  await setAutonomy(3);
  const pend = await invoke('deploy.staging', {});
  assert.strictEqual(pend.status, 'pending_approval');
  await gw().reject(user, pend.tool_call.id, { expectedVersion: pend.tool_call.version });
  const generic = await invoke('github.dispatch_workflow', { workflow: 'nexia-pipeline.yml', inputs: { target: 'staging' } });
  assert.deepStrictEqual([generic.status, generic.error.code], ['failed', 'FORBIDDEN']);
  assert.strictEqual(github.dispatches.length, 0);

  await setAutonomy(4);
  const d = await invoke('deploy.staging', {});
  assert.strictEqual(d.status, 'succeeded', JSON.stringify(d.error));
  assert.deepStrictEqual(github.dispatches, [{ workflow: 'nexia-pipeline.yml', ref: 'develop', inputs: { target: 'staging' } }]);
  const dep = await vault.Deployment.get(user, d.result.deployment_id);
  assert.deepStrictEqual([dep.status, dep.provider, dep.environment_id, dep.commit_sha, dep.url], ['pending', 'firebase', ids.staging, github.branches.get('develop'), 'https://staging.alfa.com.br']);
  assert.strictEqual(dep.release, `staging-${dep.commit_sha.slice(0, 12)}`, 'release preservado (antes colidia com o metadado version)');
  ids.deployment = dep.id;
});

test('D5. deploy.sync_status espelha o Actions no Vault (fila → em andamento → sucesso)', async () => {
  let s = await invoke('deploy.sync_status', { deployment_id: ids.deployment });
  assert.strictEqual(s.status, 'succeeded', JSON.stringify(s.error));
  assert.strictEqual(s.result.status, 'in_progress');
  github.runs[0].status = 'completed'; github.runs[0].conclusion = 'success'; github.runs[0].updated_at = new Date(Date.now() + 1000).toISOString();
  s = await invoke('deploy.sync_status', { deployment_id: ids.deployment });
  assert.strictEqual(s.result.status, 'succeeded');
  const dep = await vault.Deployment.get(user, ids.deployment);
  assert.deepStrictEqual([dep.status, !!dep.finished_at], ['succeeded', true]);
  github.runs[0].conclusion = 'failure';
  s = await invoke('deploy.sync_status', { deployment_id: ids.deployment });
  assert.strictEqual(s.result.status, 'succeeded', 'estado final não muda depois de registrado');
});

test('D6. sem staging no Vault ou com provedor não suportado: deploy.staging não dispara', async () => {
  const before = github.dispatches.length;
  const r = await gw().invoke(agent, { projectId: ids.bare, tool: 'deploy.staging', input: {} });
  assert.strictEqual(r.status, 'pending_approval', 'projeto no nível 0');
  const done = await gw().approve(user, r.tool_call.id, { expectedVersion: r.tool_call.version });
  assert.deepStrictEqual([done.status, done.error.code], ['failed', 'INVALID_INPUT']);
  assert.strictEqual(github.dispatches.length, before);
});
