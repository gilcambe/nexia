'use strict';
// Fase 8: GitHub Adapter contra um GitHub falso em memória (tests/fake-github.js).
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { createGithubAdapter } = require('../../nexia-ai/github-adapter');
const { appJwt } = require('../../nexia-ai/github-adapter/auth');
const { isSensitivePath, findSecrets, redactSecrets } = require('../../nexia-ai/github-adapter/guards');
const { createFakeGithub } = require('../fake-github');

const REPO = { owner: 'gilcambe', repo: 'nexia', default_branch: 'develop' };
const fakeKey = () => `ghp_${crypto.randomBytes(18).toString('hex')}`;
const code = async (p, c) => assert.rejects(p, e => e.code === c || assert.fail(`${e.code}: ${e.message}`));

function setup(env) {
  const gh = createFakeGithub();
  const a = createGithubAdapter({ repo: REPO, env: env || gh.env, fetchImpl: gh.fetchImpl });
  return { gh, a };
}

test('H1. GitHub App: JWT RS256 assinado, token de instalação restrito ao repositório e às permissões da operação, com cache', async () => {
  const { gh, a } = setup();
  assert.strictEqual(a.auth.mode, 'app');
  const jwt = appJwt({ appId: '1', privateKey: crypto.createPrivateKey(gh.privatePem), now: () => 1_700_000_000_000 });
  const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
  assert.deepStrictEqual([payload.iss, payload.exp - payload.iat], ['1', 540]);

  await a.listBranches();
  await a.listBranches();
  await a.createBranch({ branch: 'nexia/h1' });
  const grants = [...gh.issued.values()];
  assert.strictEqual(grants.length, 2, 'um token para leitura (reaproveitado) e outro para escrita');
  assert.deepStrictEqual(grants.map(g => g.repositories), [['nexia'], ['nexia']]);
  assert.deepStrictEqual(grants[0].permissions, { metadata: 'read', contents: 'read' });
  assert.deepStrictEqual(grants[1].permissions, { metadata: 'read', contents: 'write' });
  assert.ok(gh.calls.filter(c => c.path.startsWith('/repos/gilcambe/nexia/') && !c.path.endsWith('/installation')).every(c => c.auth === 'installation'));
});

test('H2. sem GitHub App: leitura com GITHUB_TOKEN legado ou anônima; escrita recusada', async () => {
  const gh = createFakeGithub();
  const a = createGithubAdapter({ repo: REPO, env: { GITHUB_TOKEN: 'legado' }, fetchImpl: gh.fetchImpl });
  assert.strictEqual(a.auth.mode, 'token');
  assert.strictEqual((await a.listBranches()).length, 2);
  await code(a.createBranch({ branch: 'nexia/x' }), 'GITHUB_APP_REQUIRED');
  await code(a.commitFiles({ branch: 'nexia/x', message: 'm', files: [{ path: 'a', content: 'b' }] }), 'GITHUB_APP_REQUIRED');
  await code(a.createPull({ head: 'nexia/x', title: 't' }), 'GITHUB_APP_REQUIRED');
  assert.strictEqual(createGithubAdapter({ repo: REPO, env: {}, fetchImpl: gh.fetchImpl }).auth.mode, 'none');
  assert.throws(() => createGithubAdapter({ repo: REPO, env: { GITHUB_APP_ID: '1', GITHUB_APP_PRIVATE_KEY: 'nao-e-pem' }, fetchImpl: gh.fetchImpl }), e => e.code === 'GITHUB_AUTH' && !/nao-e-pem/.test(e.message));
});

test('H3. branch: só "nexia/...", nunca a padrão, nome validado, sem sobrescrever', async () => {
  const { gh, a } = setup();
  for (const b of ['develop', 'main', 'feature/x', 'nexia', 'nexia/../main', 'nexia//x', 'nexia/x.lock', 'nexia/ x']) {
    await assert.rejects(a.createBranch({ branch: b }), e => ['FORBIDDEN', 'INVALID_INPUT'].includes(e.code), b);
  }
  const r = await a.createBranch({ branch: 'nexia/fix-form' });
  assert.strictEqual(r.sha, gh.branches.get('develop'));
  await code(a.createBranch({ branch: 'nexia/fix-form' }), 'CONFLICT');
});

test('H4. commit: um commit fast-forward com vários arquivos, só em "nexia/...", com SHA esperado', async () => {
  const { gh, a } = setup();
  await a.createBranch({ branch: 'nexia/h4' });
  const before = gh.branches.get('nexia/h4');
  const r = await a.commitFiles({ branch: 'nexia/h4', message: 'Corrige formulário', expected_head_sha: before,
    files: [{ path: 'src/app.js', content: 'console.log(2);\n' }, { path: 'src/novo/form.js', content: 'export default 1;\n' }] });
  assert.deepStrictEqual([r.parent, gh.branches.get('nexia/h4')], [before, r.commit]);
  assert.strictEqual(gh.fileAt('nexia/h4', 'src/app.js'), 'console.log(2);\n');
  assert.strictEqual(gh.fileAt('nexia/h4', 'README.md'), '# nexia\n', 'arquivos não citados ficam');
  assert.strictEqual(gh.fileAt('develop', 'src/app.js'), 'console.log(1);\n', 'branch padrão intacta');
  const patch = gh.calls.find(c => c.method === 'PATCH');
  assert.strictEqual(patch.body.force, false);
  await code(a.commitFiles({ branch: 'nexia/h4', message: 'x', expected_head_sha: before, files: [{ path: 'a.txt', content: 'a' }] }), 'CONFLICT');
  await code(a.commitFiles({ branch: 'develop', message: 'x', files: [{ path: 'a.txt', content: 'a' }] }), 'FORBIDDEN');
  await code(a.commitFiles({ branch: 'nexia/h4', message: 'x', files: Array.from({ length: 21 }, (_, i) => ({ path: `f${i}`, content: 'x' })) }), 'INVALID_INPUT');
  await code(a.commitFiles({ branch: 'nexia/h4', message: 'x', files: [{ path: 'a', content: 'x'.repeat(300 * 1024) }] }), 'INVALID_INPUT');
  await code(a.commitFiles({ branch: 'nexia/h4', message: 'x', files: [{ path: 'a', content: '1' }, { path: 'a', content: '2' }] }), 'INVALID_INPUT');
});

test('H5. arquivos sensíveis e secrets: nunca lidos nem commitados; leitura redige', async () => {
  const { a } = setup();
  await a.createBranch({ branch: 'nexia/h5' });
  for (const p of ['.env', 'config/.env.production', 'deploy/id_rsa', 'keys/server.pem', 'firebase-adminsdk-x1.json', 'terraform.tfstate', '.npmrc']) {
    await code(a.commitFiles({ branch: 'nexia/h5', message: 'x', files: [{ path: p, content: 'x' }] }), 'SENSITIVE_FILE');
    await code(a.getFile({ path: p }), 'SENSITIVE_FILE');
  }
  assert.strictEqual(isSensitivePath('.env.example'), false);
  for (const p of ['../fora', '/etc/passwd', 'a/../b', '.git/config', 'a\\b', 'a//b']) await code(a.getFile({ path: p }), 'INVALID_INPUT');
  const key = fakeKey();
  await code(a.commitFiles({ branch: 'nexia/h5', message: 'x', files: [{ path: 'src/cfg.js', content: `const k = "${key}";` }] }), 'SECRET_IN_CONTENT');
  await code(a.commitFiles({ branch: 'nexia/h5', message: `token ${key}`, files: [{ path: 'a.js', content: '1' }] }), 'SECRET_IN_CONTENT');
  await code(a.createPull({ head: 'nexia/h5', title: 'PR', body: `senha: ${key}` }), 'SECRET_IN_CONTENT');
  // Código comum (hash, lockfile, "password: req.body.password") não é falso positivo
  assert.deepStrictEqual(findSecrets('const password = req.body.password;\n"integrity": "sha512-' + 'a'.repeat(80) + '"\ncommit 0123456789abcdef0123456789abcdef01234567'), []);
  const r = redactSecrets(`url=https://user:${key}@example.com x=${key}`);
  assert.ok(!r.text.includes(key) && r.count >= 2);
});

test('H6. PR: de "nexia/..." para a padrão, rascunho por padrão; head inválido recusado', async () => {
  const { gh, a } = setup();
  await a.createBranch({ branch: 'nexia/h6' });
  await a.commitFiles({ branch: 'nexia/h6', message: 'muda', files: [{ path: 'src/app.js', content: '3\n' }] });
  const pr = await a.createPull({ head: 'nexia/h6', title: 'Fase 8: teste', body: 'corpo' });
  assert.deepStrictEqual([pr.number, pr.base, pr.draft], [1, 'develop', true]);
  assert.strictEqual(gh.pulls[0].draft, true);
  await code(a.createPull({ head: 'develop', base: 'main', title: 't' }), 'FORBIDDEN');
  await code(a.createPull({ head: 'nexia/h6', base: 'nexia/h6', title: 't' }), 'INVALID_INPUT');
  const diff = await a.compare({ base: 'develop', head: 'nexia/h6' });
  assert.deepStrictEqual(diff.files.map(f => [f.path, f.status]), [['src/app.js', 'modified']]);
});

test('H7. workflow_dispatch: CI sim; deploy, produção e branch qualquer não', async () => {
  const { gh, a } = setup();
  await a.createBranch({ branch: 'nexia/h7' });
  assert.deepStrictEqual(await a.dispatchWorkflow({ workflow: 'ci.yml', ref: 'nexia/h7' }), { workflow: 'ci.yml', ref: 'nexia/h7', dispatched: true });
  assert.strictEqual(gh.dispatches.length, 1);
  for (const w of ['deploy.yml', 'deploy-prod.yaml', 'release.yml', 'publish.yml', 'production.yml']) await code(a.dispatchWorkflow({ workflow: w }), 'FORBIDDEN');
  await code(a.dispatchWorkflow({ workflow: 'ci.yml', ref: 'main' }), 'FORBIDDEN');
  await code(a.dispatchWorkflow({ workflow: 'ci.yml', inputs: { environment: 'staging' } }), 'FORBIDDEN');
  await code(a.dispatchWorkflow({ workflow: 'ci.yml', inputs: { alvo: 'production' } }), 'FORBIDDEN');
  await code(a.dispatchWorkflow({ workflow: '../x.yml' }), 'INVALID_INPUT');
  assert.strictEqual(gh.dispatches.length, 1);
});

test('H8. erros não vazam token, chave nem corpo da requisição', async () => {
  const gh = createFakeGithub();
  const a = createGithubAdapter({ repo: { ...REPO, repo: 'outro' }, env: gh.env, fetchImpl: gh.fetchImpl });
  await assert.rejects(a.listBranches(), e => {
    assert.strictEqual(e.code, 'GITHUB_AUTH');
    const s = JSON.stringify({ m: e.message, d: e.details });
    assert.ok(!s.includes('PRIVATE KEY') && !/ghs_/.test(s) && !s.includes('eyJ'), s);
    return true;
  });
  const { a: ok } = setup();
  await ok.createBranch({ branch: 'nexia/h8' });
  await assert.rejects(ok.createBranch({ branch: 'nexia/h8' }), e => e.code === 'CONFLICT' && /Reference already exists/.test(e.message) && !/ghs_/.test(e.message));
});
