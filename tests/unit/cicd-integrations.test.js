'use strict';
// Fase 9: pipeline modelo, adapters Firebase e Cloudflare e credenciais por tenant.
const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('child_process');
const { buildPipeline, renderPipeline } = require('../../nexia-ai/cicd/pipeline');
const { createFirebaseAdapter } = require('../../nexia-ai/firebase-adapter');
const { createCloudflareAdapter, parseRef } = require('../../nexia-ai/cloudflare-adapter');
const { credentialFor, allowedPrefix } = require('../../nexia-ai/integrations');
const { createFakeGoogle, createFakeCloudflare } = require('../fake-cloud');

const code = async (p, c) => assert.rejects(p, e => e.code === c || assert.fail(`${e.code}: ${e.message}`));

function parseYaml(text) {
  try {
    return JSON.parse(execFileSync('python3', ['-c', 'import sys,yaml,json; d=yaml.safe_load(sys.stdin); d["on"]=d.pop(True); print(json.dumps(d))'], { input: text }).toString());
  } catch (e) { return { __skip: String(e.message).slice(0, 200) }; }
}

test('C1. pipeline modelo: CI em push/PR; staging e produção só por workflow_dispatch; produção depois do smoke de staging', t => {
  const r = renderPipeline({ defaultBranch: 'develop', healthPath: '/health', staging: { provider: 'firebase', url: 'https://staging.alfa.com.br' }, production: { provider: 'firebase' } });
  assert.strictEqual(r.path, '.github/workflows/nexia-pipeline.yml');
  const wf = parseYaml(r.content);
  if (wf.__skip) return t.skip(`PyYAML indisponível: ${wf.__skip}`);
  assert.deepStrictEqual(wf, JSON.parse(JSON.stringify(r.workflow)), 'o YAML gerado é exatamente o objeto do pipeline');
  assert.deepStrictEqual(Object.keys(wf.on).sort(), ['pull_request', 'push', 'workflow_dispatch']);
  assert.deepStrictEqual(wf.on.workflow_dispatch.inputs.target.options, ['none', 'staging', 'production']);
  assert.deepStrictEqual(wf.permissions, { contents: 'read' });
  assert.deepStrictEqual(wf.jobs.ci.steps.map(s => s.name), ['Checkout', 'Node', 'Instalar dependências', 'Lint', 'Testes', 'Build',
    'Dependências (vulnerabilidade alta ou crítica falha)', 'Secret scan (gitleaks, checksum verificado)']);
  const st = wf.jobs['deploy-staging'];
  const pr = wf.jobs['deploy-production'];
  assert.deepStrictEqual([st.needs, st.environment.name, pr.needs, pr.environment.name], ['ci', 'staging', 'deploy-staging', 'production']);
  assert.match(st.if, /workflow_dispatch/);
  assert.strictEqual(pr.if, "github.event_name == 'workflow_dispatch' && inputs.target == 'production'");
  assert.strictEqual(pr.environment.url, '${{ vars.PRODUCTION_URL }}');
  assert.deepStrictEqual(st.permissions, { contents: 'read', 'id-token': 'write' }, 'Firebase por OIDC, sem chave');
  assert.ok(st.steps.some(s => s.uses === 'google-github-actions/auth@v2'));
  assert.ok(st.steps.at(-1).name.startsWith('Smoke') && st.steps.at(-1).env.HEALTH_PATH === '/health');
  assert.strictEqual(pr.concurrency['cancel-in-progress'], false);
});

test('C2. provedores: Cloudflare e Render com segredos do environment; entradas inválidas recusadas', () => {
  const cf = buildPipeline({ defaultBranch: 'main', staging: { provider: 'cloudflare' }, production: { provider: 'render' }, outputDir: 'out', scripts: { lint: null } });
  const st = cf.jobs['deploy-staging'].steps.find(s => /Cloudflare/.test(s.name));
  assert.match(st.run, /wrangler@3 pages deploy "out" .*--branch "staging"/);
  assert.deepStrictEqual(st.env, { CLOUDFLARE_API_TOKEN: '${{ secrets.CLOUDFLARE_API_TOKEN }}', CLOUDFLARE_ACCOUNT_ID: '${{ vars.CLOUDFLARE_ACCOUNT_ID }}' });
  assert.ok(!cf.jobs.ci.steps.some(s => s.name === 'Lint'), 'lint: null tira o passo');
  assert.deepStrictEqual(cf.jobs['deploy-production'].steps.find(s => /Render/.test(s.name)).env, { RENDER_DEPLOY_HOOK: '${{ secrets.RENDER_DEPLOY_HOOK }}' });
  assert.deepStrictEqual(Object.keys(buildPipeline({ defaultBranch: 'main' }).jobs), ['ci'], 'sem ambientes, só CI');
  assert.throws(() => buildPipeline({ defaultBranch: 'main', staging: { provider: 'vercel' } }), e => e.code === 'INVALID_INPUT');
  assert.throws(() => buildPipeline({ defaultBranch: 'main', production: { provider: 'render' } }), e => e.code === 'INVALID_INPUT' && /staging/.test(e.message));
  for (const bad of [{ scripts: { test: 'test; curl evil' } }, { outputDir: '../etc' }, { healthPath: 'x"; rm' }, { node: '20; x' }, { defaultBranch: 'a b' }]) {
    assert.throws(() => buildPipeline({ defaultBranch: 'main', ...bad }), e => e.code === 'INVALID_INPUT', JSON.stringify(bad));
  }
});

test('C3. Firebase: service account assina JWT, token de leitura em cache; produto sem acesso aparece como não usado', async () => {
  const g = createFakeGoogle();
  const fb = createFirebaseAdapter({ projectId: g.projectId, credential: g.serviceAccount, fetchImpl: g.fetchImpl });
  const p = await fb.getProject();
  assert.deepStrictEqual([p.project_id, p.resources.hosting_site], ['cliente-alfa', 'cliente-alfa']);
  const s = await fb.getStatus();
  assert.deepStrictEqual([s.hosting.used, s.rules.used, s.firestore.used, s.functions.used], [true, true, true, false]);
  assert.strictEqual(s.hosting.sites[0].last_release.version_status, 'FINALIZED');
  assert.deepStrictEqual(s.rules.releases.map(r => r.name), ['cloud.firestore']);
  assert.strictEqual(g.calls.filter(c => c.host === 'oauth2.googleapis.com').length, 1, 'um token para todas as chamadas');
  assert.deepStrictEqual([...g.tokens.values()], ['https://www.googleapis.com/auth/firebase.readonly https://www.googleapis.com/auth/cloud-platform.read-only']);
  assert.throws(() => createFirebaseAdapter({ projectId: 'Projeto Inválido', credential: g.serviceAccount }), e => e.code === 'INVALID_INPUT');
  assert.throws(() => createFirebaseAdapter({ projectId: 'cliente-alfa', credential: JSON.stringify({ type: 'service_account', client_email: 'x', ['private' + '_key']: 'nao' }) }), e => e.code === 'PROVIDER_AUTH' && !/nao/.test(e.message));
  const other = createFakeGoogle();
  const wrong = createFirebaseAdapter({ projectId: g.projectId, credential: other.serviceAccount, fetchImpl: g.fetchImpl });
  await code(wrong.getProject(), 'PROVIDER_AUTH');
});

test('C4. Cloudflare: Pages, Workers e DNS por external_ref; TXT omitido; token inválido não vaza', async () => {
  const cf = createFakeCloudflare();
  const pages = await createCloudflareAdapter({ externalRef: `pages:${cf.account}:site-alfa`, token: cf.token, fetchImpl: cf.fetchImpl }).deploymentStatus({ limit: 5 });
  assert.deepStrictEqual(pages.deployments.map(d => [d.environment, d.branch, d.stage]), [['preview', 'staging', 'deploy:success'], ['production', 'main', 'deploy:success']]);
  assert.deepStrictEqual(pages.custom_domains, [{ name: 'alfa.com.br', status: 'active' }]);
  const w = await createCloudflareAdapter({ externalRef: `workers:${cf.account}:api-alfa`, token: cf.token, fetchImpl: cf.fetchImpl }).deploymentStatus();
  assert.deepStrictEqual(w.deployments[0].versions, [{ version_id: 'v1', percentage: 100 }]);
  const dns = await createCloudflareAdapter({ externalRef: `zone:${cf.zone}`, token: cf.token, fetchImpl: cf.fetchImpl }).listDns();
  assert.ok(!JSON.stringify(dns).includes('segredo-de-verificacao'));
  assert.strictEqual(dns.records[0].content, '192.0.2.10');
  for (const bad of ['pages:x:site', `pages:${cf.account}:../x`, `zone:${cf.zone}:extra`, 'dns:abc', '']) assert.throws(() => parseRef(bad), e => e.code === 'INVALID_INPUT', bad);
  await assert.rejects(createCloudflareAdapter({ externalRef: `zone:${cf.zone}`, token: 'token-errado-123', fetchImpl: cf.fetchImpl }).listDns(),
    e => e.code === 'PROVIDER_AUTH' && !e.message.includes('token-errado-123'));
});

test('C5. credencial só com o nome do próprio tenant (NEXIA_<PROVEDOR>_<TENANT>_...)', () => {
  const ctx = { tenantId: 'cliente-alfa' };
  const it = name => ({ provider: 'firebase', secret_refs: [{ name, store: 'env' }] });
  const env = { NEXIA_FIREBASE_CLIENTE_ALFA_SA: 'valor', NEXIA_FIREBASE_NEXIA_SA: 'outro', FIREBASE_SERVICE_ACCOUNT: 'do-nexia' };
  assert.strictEqual(allowedPrefix('firebase', 'cliente-alfa'), 'NEXIA_FIREBASE_CLIENTE_ALFA_');
  assert.strictEqual(credentialFor({ env, ctx }, it('NEXIA_FIREBASE_CLIENTE_ALFA_SA')), 'valor');
  for (const name of ['NEXIA_FIREBASE_NEXIA_SA', 'FIREBASE_SERVICE_ACCOUNT', 'NEXIA_FIREBASE_CLIENTE_ALFA_', 'NEXIA_CLOUDFLARE_CLIENTE_ALFA_X']) {
    assert.throws(() => credentialFor({ env, ctx }, it(name)), e => e.code === 'SCOPE', name);
  }
  assert.throws(() => credentialFor({ env: {}, ctx }, it('NEXIA_FIREBASE_CLIENTE_ALFA_SA')), e => e.code === 'CREDENTIAL_MISSING' && !/valor/.test(e.message));
  assert.throws(() => credentialFor({ env, ctx }, { provider: 'firebase', secret_refs: [] }), e => e.code === 'INVALID_INPUT');
});
