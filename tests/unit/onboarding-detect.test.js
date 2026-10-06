'use strict';
// Onboarding (Fase 3): detecção a partir dos arquivos reais deste repositório e
// proteções da fonte local. Sem rede e sem Firestore.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { detect, parseRenderYaml, envNames } = require('../../nexia-ai/onboarding/detect');
const { createLocalSource, createGithubSource, NEVER_READ } = require('../../nexia-ai/onboarding/sources');

const ROOT = path.join(__dirname, '..', '..');

test('detecta stack, scripts, Firebase, hosting e documentação deste repositório', async () => {
  const src = createLocalSource(ROOT);
  const files = await src.files();
  const d = await detect(files, p => src.read(p));
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  for (const s of ['node', 'react', 'firebase', 'typescript']) assert.ok(d.stack.includes(s), s);
  for (const f of ['vite', 'express', 'tailwindcss', 'playwright']) assert.ok(d.frameworks.includes(f), f);
  assert.deepStrictEqual(d.commands, { dev: 'npm run dev', build: 'npm run build', test: 'npm test', start: 'npm start' });
  assert.strictEqual(d.nodeEngine, pkg.engines.node);
  assert.deepStrictEqual(d.firebase, { services: ['emulators', 'firestore', 'storage'] });
  assert.strictEqual(d.firebaseProject, 'nexia-c8710'); // config web pública nas páginas legadas
  assert.ok(d.evidence.some(e => e.what === 'firebase_project' && /\.html$/.test(e.file)));
  assert.strictEqual(d.deployTarget, 'cloudflare'); // ADR-HOST-01: sem Render
  assert.deepStrictEqual(d.environments, [{ name: 'production', provider: 'cloudflare', urls: [], branch: null, source: 'wrangler.jsonc' }]);
  assert.strictEqual(d.cloudflareRef, 'nexia');
  assert.deepStrictEqual(d.workflows, ['.github/workflows/auto-merge.yml', '.github/workflows/ci.yml', '.github/workflows/clonar-site.yml', '.github/workflows/deploy-cloudflare.yml', '.github/workflows/diagnostico.yml', '.github/workflows/nexia-jobs.yml', '.github/workflows/preview-site.yml', '.github/workflows/publicar-indices.yml', '.github/workflows/publicar-regras.yml', '.github/workflows/smoke-logado.yml', '.github/workflows/smoke.yml']);
  assert.ok(d.docs.includes('ARCHITECTURE-DECISIONS.md') && d.docs.includes('VAULT-SCHEMAS.md'));
  assert.ok(d.secretNames.includes('GROQ_API_KEY') && d.secretNames.includes('FIREBASE_SERVICE_ACCOUNT_BASE64'));
  assert.ok(d.directoryStructure.some(x => x.startsWith('netlify/ (')));
  assert.ok(!files.some(f => f.startsWith('node_modules/') || f.startsWith('out/')), 'só arquivos versionados');
  assert.match(d.architecture, /Deploy: cloudflare\./);
});

test('render.yaml (repositório de cliente) e .env.example: extrai serviços e só NOMES de variáveis', () => {
  const yaml = 'services:\n  - type: web\n    name: nexia-os-frontend\n    envVars:\n      - key: VITE_NEXIA_API_URL\n        value: https://nexia-os.onrender.com\n';
  const services = parseRenderYaml(yaml);
  assert.deepStrictEqual(services, [{ type: 'web', name: 'nexia-os-frontend', branch: null, urls: ['https://nexia-os.onrender.com'] }]);
  const names = envNames('A_KEY=valor-secreto\n# COMENTARIO=x\nexport B_TOKEN="x"\nminuscula=1\n');
  assert.deepStrictEqual(names, ['A_KEY', 'B_TOKEN']);
});

test('valores de exemplo do Firebase não viram projeto detectado', async () => {
  const files = ['index.html'];
  const d = await detect(files, async () => "firebase.initializeApp({ projectId: 'your-project-id' }); x({projectId: \"my-firebase-project\"})");
  assert.strictEqual(d.firebaseProject, null);
});

test('fonte local: não lê .env, não sai da raiz, não segue symlink', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexia-src-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'nexia-out-'));
  fs.writeFileSync(path.join(dir, '.env'), 'GROQ_API_KEY=valor');
  fs.writeFileSync(path.join(dir, '.env.example'), 'GROQ_API_KEY=');
  fs.writeFileSync(path.join(outside, 'secret.txt'), 'fora');
  fs.symlinkSync(path.join(outside, 'secret.txt'), path.join(dir, 'link.txt'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"x"}');
  const src = createLocalSource(dir);
  assert.strictEqual(await src.read('.env'), null);
  assert.strictEqual(await src.read('.env.local'), null);
  assert.strictEqual(await src.read('.env.example'), 'GROQ_API_KEY=');
  assert.strictEqual(await src.read('../' + path.basename(outside) + '/secret.txt'), null);
  assert.strictEqual(await src.read('link.txt'), null);
  assert.ok(!(await src.files()).includes('link.txt'));
  for (const p of ['.env', 'config/.env.production', 'keys/server.pem', 'serviceAccount.json', 'service-account-prod.json']) assert.ok(NEVER_READ.test(p), p);
  for (const p of ['.env.example', 'src/env.ts', 'package.json']) assert.ok(!NEVER_READ.test(p), p);
});

test('fonte GitHub: valida owner/repo/ref antes de qualquer chamada', () => {
  for (const bad of [{ owner: '../x', repo: 'y' }, { owner: 'a', repo: 'b c' }, { owner: 'a', repo: 'b', ref: 'x;rm' }]) {
    assert.throws(() => createGithubSource({ ...bad, fetchImpl: () => { throw new Error('não deveria chamar'); } }), { code: 'INVALID' });
  }
});
