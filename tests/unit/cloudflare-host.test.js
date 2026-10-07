'use strict';
// ADR-FREE-01/02: hospedagem só no plano grátis (Cloudflare Worker + Firebase Spark + GitHub Actions).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { handleRequest, populateProcessEnv, firebaseConfig, _resetWebConfigCache, MAX_BODY_SIZE } = require('../../cloudflare/app');
const { LOADERS } = require('../../cloudflare/functions');
const { validateJob, createJobs, scheduledSweep } = require('../../nexia-ai/jobs');
const { encodeValue, decodeValue, Timestamp, FieldValue } = require('../../lib/firebase-lite/values');

const ROOT = path.join(__dirname, '..', '..');
const readWrangler = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, ''));

// ASSETS falso: devolve os arquivos do mapa, 404 para o resto.
function fakeAssets(files) {
  return { async fetch(req) {
    const p = new URL(req.url).pathname;
    return p in files ? new Response(files[p], { status: 200, headers: { 'Content-Type': 'text/html' } }) : new Response('nf', { status: 404 });
  } };
}
const FILES = { '/index.html': 'SPA', '/assets/app-1.js': 'js', '/ces/ces-landing.html': 'CES', '/body-coach/index.html': 'BC', '/body-coach/assets/bc-1.js': 'bcjs' };
const call = (url, init = {}, env = {}, getFunction = () => null) =>
  handleRequest(new Request('https://nexia.test' + url, init), { ASSETS: fakeAssets(FILES), ...env }, { getFunction });

test('CF1. config do Worker: plano grátis, sem Container/Durable Object, cron a cada 5 min (ADR-AUTO-01), sem Render', () => {
  const wr = readWrangler();
  assert.strictEqual(wr.main, 'cloudflare/worker.js');
  assert.strictEqual(wr.containers, undefined, 'Container exige Workers Paid');
  assert.strictEqual(wr.durable_objects, undefined);
  assert.deepStrictEqual(wr.triggers.crons, ['*/5 * * * *']);
  assert.strictEqual(wr.assets.binding, 'ASSETS');
  assert.ok(!fs.existsSync(path.join(ROOT, 'Dockerfile')));
  assert.ok(!fs.existsSync(path.join(ROOT, 'render.yaml')));
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  for (const dep of ['firebase-admin', '@cloudflare/containers']) {
    assert.ok(!(pkg.dependencies || {})[dep] && !(pkg.devDependencies || {})[dep], dep);
  }
  const deploy = fs.readFileSync(path.join(ROOT, '.github/workflows/deploy-cloudflare.yml'), 'utf8');
  // ADR-AUTO-02: automático só depois do CI verde num push da develop; nunca direto em push/PR.
  assert.match(deploy, /^on:\n  workflow_dispatch:/m);
  assert.match(deploy, /workflow_run:\n    workflows: \[CI\]\n    types: \[completed\]\n    branches: \[develop\]/);
  assert.match(deploy, /workflow_run\.conclusion == 'success'/);
  assert.match(deploy, /head_sha \|\| github\.sha/, 'publica exatamente o commit que passou no CI');
  assert.match(deploy, /wrangler@4 rollback/, 'volta sozinho se o site não responder');
  assert.match(deploy, /registrar-deploy\.js inicio/);
  assert.doesNotMatch(deploy, /^\s+(push|pull_request|pull_request_target|schedule):/m);
  for (const f of ['server.js', 'src/config/env.ts', 'index.html', 'netlify/functions/sentinel.js', 'src/pages/tenant/page.tsx', 'ces/ces-app-executivo.html']) {
    assert.doesNotMatch(fs.readFileSync(path.join(ROOT, f), 'utf8'), /onrender\.com|RENDER_EXTERNAL_URL/, f);
  }
});

test('CF2. populateProcessEnv copia só textos com nome válido e define NODE_ENV', () => {
  const before = { ...process.env };
  try {
    delete process.env.NODE_ENV;
    populateProcessEnv({ CF_TEST_VAR: 'a', ASSETS: {}, 'bad-name': 'x', NUM: 3 });
    assert.strictEqual(process.env.NODE_ENV, 'production');
    assert.strictEqual(process.env.CF_TEST_VAR, 'a');
    assert.strictEqual(process.env['bad-name'], undefined);
    assert.strictEqual(process.env.NUM, undefined);
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in before)) delete process.env[k];
    Object.assign(process.env, before);
  }
});

test('CF3. Worker: health, métodos, caminhos inválidos, páginas de tenant, SPA e arquivos privados', async () => {
  const h = await call('/health');
  assert.strictEqual(h.status, 200);
  assert.deepStrictEqual((({ status, runtime }) => ({ status, runtime }))(await h.json()), { status: 'ok', runtime: 'cloudflare-worker' });
  assert.strictEqual((await call('/', { method: 'POST' })).status, 405);
  assert.strictEqual((await call('/a%2fb')).status, 400);
  assert.strictEqual(await (await call('/ces/landing')).text(), 'CES');
  assert.strictEqual(await (await call('/projetos')).text(), 'SPA');
  assert.strictEqual(await (await call('/painel.html')).text(), 'SPA');
  const asset = await call('/assets/app-1.js');
  assert.strictEqual(asset.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.strictEqual(asset.headers.get('x-content-type-options'), 'nosniff');
  for (const p of ['/server.js', '/.env', '/package.json', '/firebase-adminsdk.json']) {
    assert.ok([400, 404].includes((await call(p)).status), p);
  }
  assert.strictEqual((await call('/api/firebase-config')).status, 503);
  const cfg = await call('/api/firebase-config', {}, { FIREBASE_API_KEY: 'pub', FIREBASE_PROJECT_ID: 'demo' });
  assert.deepStrictEqual((({ apiKey, projectId }) => ({ apiKey, projectId }))(await cfg.json()), { apiKey: 'pub', projectId: 'demo' });
});

test('CF13. Worker: /body-coach/* serve o SPA do Body Coach (ADR-CLONE-02), sem tocar no SPA principal', async () => {
  for (const p of ['/body-coach', '/body-coach/', '/body-coach/workout', '/body-coach/evolution/x']) {
    assert.strictEqual(await (await call(p)).text(), 'BC', p);
  }
  assert.strictEqual(await (await call('/body-coach/assets/bc-1.js')).text(), 'bcjs');
  assert.strictEqual((await call('/body-coach/assets/nao-existe.js')).status, 404);
  assert.strictEqual(await (await call('/body-coachx')).text(), 'SPA');
  assert.strictEqual((await call('/body-coach/workout', { method: 'POST' })).status, 405);
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.match(pkg.scripts['build:worker'], /build:body-coach/);
  assert.ok(fs.existsSync(path.join(ROOT, 'apps/body-coach/package-lock.json')), 'lock do sub-app versionado (npm ci)');
  const bc = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps/body-coach/package.json'), 'utf8'));
  for (const dep of ['@supabase/supabase-js', '@stripe/react-stripe-js']) assert.ok(!bc.dependencies[dep], dep);
});

test('CF4. Worker: API vai para o handler Netlify; 404 sem função; 413 acima de 1 MB; erro sem detalhe interno', async () => {
  let seen;
  const fn = { handler: async (ev) => { seen = ev; return { statusCode: 201, body: JSON.stringify({ ok: true }) }; } };
  const r = await call('/api/nexia/projects?x=1', { method: 'POST', body: '{"a":1}', headers: { 'X-Tenant-Id': 'ces' } }, {}, n => (n === 'nexia-api' ? fn : null));
  assert.strictEqual(r.status, 201);
  assert.deepStrictEqual([seen.httpMethod, seen.path, seen.queryStringParameters.x, seen.headers['x-tenant-id'], seen.body], ['POST', '/api/nexia/projects', '1', 'ces', '{"a":1}']);
  assert.strictEqual((await call('/api/nao-existe')).status, 404);
  const big = await call('/api/nexia/x', { method: 'POST', body: 'x'.repeat(MAX_BODY_SIZE + 1) }, {}, () => fn);
  assert.strictEqual(big.status, 413);
  const boom = await call('/api/nexia/x', {}, {}, () => ({ handler: async () => { throw new Error('segredo interno /home/x'); } }));
  assert.strictEqual(boom.status, 500);
  assert.doesNotMatch(await boom.text(), /segredo interno|\/home\//);
});

test('CF5. lista de handlers do Worker bate com netlify/functions/ (o bundle não segue require dinâmico)', () => {
  const files = fs.readdirSync(path.join(ROOT, 'netlify/functions'))
    .filter(f => f.endsWith('.js') && !['firebase-init.js', 'firebase-vault.js', 'middleware.js'].includes(f)).map(f => f.slice(0, -3));
  assert.deepStrictEqual(Object.keys(LOADERS).filter(k => k !== 'nexia-api').sort(), files.sort());
  assert.ok(LOADERS['nexia-api']);
});

const ID = 'exe_' + 'a'.repeat(32);
const ACTOR = { type: 'user', id: 'uid-1' };

test('CF6. fila de tarefas: valida só ids; despacha para o workflow com token; recusa sem token', async () => {
  assert.deepStrictEqual(validateJob({ kind: 'execution.run', tenant: 'ces', actor: ACTOR, id: ID, extra: 'x' }), { kind: 'execution.run', tenant: 'ces', actor: ACTOR, id: ID });
  for (const bad of [null, { kind: 'rm' }, { kind: 'execution.run', tenant: 'ces', actor: ACTOR, id: 'x' },
    { kind: 'execution.run', tenant: 'CES!', actor: ACTOR, id: ID }, { kind: 'sweep', tenant: 'ces' },
    { kind: 'project.onboard', tenant: 'ces', actor: ACTOR, id: 'prj_' + 'b'.repeat(32), repository: { owner: 'a/b', repo: 'c' } }]) {
    assert.throws(() => validateJob(bad), e => e.code === 'INVALID_JOB', JSON.stringify(bad));
  }
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return { status: 204 }; };
  const jobs = createJobs({ env: { NEXIA_JOBS: 'github', NEXIA_JOBS_TOKEN: 't0k' }, fetchImpl });
  assert.deepStrictEqual(await jobs.dispatch({ kind: 'sweep' }), { queued: true, kind: 'sweep' });
  assert.strictEqual(calls[0].url, 'https://api.github.com/repos/gilcambe/nexia/actions/workflows/nexia-jobs.yml/dispatches');
  assert.strictEqual(calls[0].init.headers.Authorization, 'Bearer t0k');
  assert.deepStrictEqual(JSON.parse(calls[0].init.body), { ref: 'develop', inputs: { job: '{"kind":"sweep"}' } });
  await assert.rejects(createJobs({ env: { NEXIA_JOBS: 'github' }, fetchImpl }).dispatch({ kind: 'sweep' }), e => e.code === 'NO_TOKEN');
  await assert.rejects(createJobs({ env: { NEXIA_JOBS: 'github', NEXIA_JOBS_TOKEN: 't' }, fetchImpl: async () => ({ status: 403 }) }).dispatch({ kind: 'sweep' }), e => e.code === 'DISPATCH_FAILED');
  assert.strictEqual(createJobs({ env: {} }).enabled, false);
});

test('CF7. cron do Worker só dispara a retomada (de hora em hora) quando há execução parada há mais de 10 min', async () => {
  const now = Date.parse('2026-10-04T12:00:00Z');
  // Banco falso: execuções para a consulta de status; nenhum robô vencido.
  const fakeDb = rows => ({ collection: name => {
    const q = { where: () => q, orderBy: () => q, limit: () => q, select: () => q,
      get: async () => ({ docs: (name === 'vault_executions' ? rows : []).map(r => ({ data: () => r })) }) };
    return q;
  } });
  const sent = [];
  const jobs = { enabled: true, dispatch: async j => { sent.push(j); return { queued: true }; } };
  assert.deepStrictEqual(await scheduledSweep({ db: fakeDb([{ updated_at: '2026-10-04T11:55:00Z' }]), jobs, now: () => now }), { robots: 0, stale: 0 });
  assert.deepStrictEqual(await scheduledSweep({ db: fakeDb([{ updated_at: Timestamp.fromMillis(now - 11 * 60000) }, { updated_at: '2026-10-04T10:00:00Z', deleted_at: 'x' }]), jobs, now: () => now }), { robots: 0, stale: 1, queued: true });
  assert.deepStrictEqual(sent, [{ kind: 'sweep' }]);
  // Fora do primeiro tique da hora, nem consulta execuções.
  assert.deepStrictEqual(await scheduledSweep({ db: fakeDb([{ updated_at: '2026-10-04T10:00:00Z' }]), jobs, now: () => now + 25 * 60000 }), { robots: 0 });
  assert.strictEqual(sent.length, 1);
  assert.deepStrictEqual(await scheduledSweep({ jobs: { enabled: false } }), { skipped: 'NEXIA_JOBS desligado' });
});

test('CF8. firebase-lite: valores do Firestore REST vão e voltam iguais', () => {
  const ts = Timestamp.fromISO('2026-10-04T12:00:00.123456Z');
  const v = { s: 'a', n: 3, f: 1.5, big: 2 ** 60, b: true, z: null, arr: [1, 'x'], obj: { k: ts } };
  const enc = encodeValue(v);
  assert.deepStrictEqual(enc.mapValue.fields.n, { integerValue: '3' });
  assert.deepStrictEqual(enc.mapValue.fields.f, { doubleValue: 1.5 });
  assert.deepStrictEqual(enc.mapValue.fields.obj.mapValue.fields.k, { timestampValue: '2026-10-04T12:00:00.123456000Z' });
  const back = decodeValue(enc);
  assert.strictEqual(back.obj.k.toISO(), ts.toISO());
  assert.deepStrictEqual({ ...back, obj: null }, { ...v, obj: null });
  assert.ok(FieldValue.serverTimestamp() && FieldValue.increment(1));
});

test('CF9. deploy copia ao Worker só os nomes do .env.example com valor; nunca o token do Actions nem o do Cloudflare', () => {
  const { pickWorkerSecrets } = require('../../scripts/worker-secrets');
  const got = pickWorkerSecrets({ FIREBASE_SERVICE_ACCOUNT_BASE64: 'a', GEMINI_API_KEY: 'b', NEXIA_JOBS_TOKEN: 'c', MASTER_EMAIL: 'd',
    GITHUB_TOKEN: 'f', CLOUDFLARE_API_TOKEN: 'g', RANDOM_THING: 'h', GITHUB_APP_ID: 'i', OPENAI_API_KEY: '', PATH: '/bin' });
  assert.deepStrictEqual(Object.keys(got).sort(), ['FIREBASE_SERVICE_ACCOUNT_BASE64', 'GEMINI_API_KEY', 'GITHUB_APP_ID', 'MASTER_EMAIL', 'NEXIA_JOBS_TOKEN']);
});

test('CF10. workflows com segredos listam cada nome (sem toJSON(secrets), que o GitHub segura para aprovação)', () => {
  const { NAMES } = require('../../scripts/worker-secrets');
  const src = n => (n.startsWith('GITHUB_') ? `NEXIA_${n}` : n);
  for (const f of ['nexia-jobs.yml', 'deploy-cloudflare.yml']) {
    const y = fs.readFileSync(path.join(ROOT, '.github/workflows', f), 'utf8');
    assert.doesNotMatch(y, /toJSON\(secrets\)/, f);
    for (const n of NAMES) {
      if (f === 'nexia-jobs.yml' && n === 'NEXIA_JOBS_TOKEN') { assert.ok(!y.includes('secrets.NEXIA_JOBS_TOKEN'), 'jobs não dispara jobs'); continue; }
      assert.ok(y.includes(`${n}: \${{ secrets.${src(n)} }}`), `${f}: ${n}`);
    }
  }
});

test('CF11. assistente do Windows: grava só nomes do .env.example; deploy não apaga variáveis do painel', () => {
  const { NAMES } = require('../../scripts/worker-secrets');
  const ps = fs.readFileSync(path.join(ROOT, 'scripts/configurar-nexia.ps1'), 'utf8');
  const bat = fs.readFileSync(path.join(ROOT, 'scripts/configurar-nexia.bat'), 'utf8');
  assert.match(bat, /raw\.githubusercontent\.com\/gilcambe\/nexia\/develop\/scripts\/configurar-nexia\.ps1/);
  const gravados = [...ps.matchAll(/Gravar '([A-Z][A-Z0-9_]+)'/g)].map(m => m[1]);
  const usados = new Set([...ps.matchAll(/'((?:FIREBASE|MASTER|GEMINI|NEXIA)_[A-Z0-9_]+|MASTER_EMAIL)'/g)].map(m => m[1]));
  assert.ok(gravados.length >= 4);
  // No GitHub os GITHUB_* ficam como NEXIA_GITHUB_* (o deploy devolve o nome original).
  for (const n of usados) assert.ok(NAMES.includes(n.replace(/^NEXIA_GITHUB_/, 'GITHUB_')), n);
  assert.doesNotMatch(ps, /Write-Host[^\n]*\$(valor|json|bloco)\b/, 'nunca mostra valor de segredo');
  assert.strictEqual(readWrangler().keep_vars, true);
});

test('CF12. /api/firebase-config sem FIREBASE_API_KEY lê a config do app da Web com a chave de serviço', async () => {
  const { privateKey } = require('crypto').generateKeyPairSync('rsa', { modulusLength: 2048 });
  const sa = { project_id: 'demo-p', client_email: 'sa@demo-p.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  const env = { FIREBASE_SERVICE_ACCOUNT_BASE64: Buffer.from(JSON.stringify(sa)).toString('base64') };
  const seen = [];
  const fake = async (u, o = {}) => {
    seen.push(String(u));
    const body = String(u).includes('oauth2') ? { access_token: 't', expires_in: 3600 }
      : String(u).endsWith('/webApps') ? { apps: [{ appId: '1:2:web:3', state: 'ACTIVE' }] }
      : { apiKey: 'pub-key', projectId: 'demo-p', authDomain: 'demo-p.firebaseapp.com', messagingSenderId: '2', storageBucket: 'demo-p.appspot.com' };
    if (!String(u).includes('oauth2')) assert.strictEqual(o.headers.Authorization, 'Bearer t');
    return new Response(JSON.stringify(body), { status: 200 });
  };
  _resetWebConfigCache();
  const r = await firebaseConfig(env, fake);
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(await r.json(), { apiKey: 'pub-key', authDomain: 'demo-p.firebaseapp.com', projectId: 'demo-p', storageBucket: 'demo-p.appspot.com', messagingSenderId: '2', appId: '1:2:web:3' });
  assert.ok(seen[2].endsWith('/projects/demo-p/webApps/1%3A2%3Aweb%3A3/config'));
  await firebaseConfig(env, fake);
  assert.strictEqual(seen.length, 3, 'segunda chamada usa o cache');
  _resetWebConfigCache();
  const fail = await firebaseConfig(env, async (u) => new Response('{}', { status: String(u).includes('oauth2') ? 200 : 403 }));
  assert.strictEqual(fail.status, 503);
  _resetWebConfigCache();
});

test('CF-fila. o cron do Worker acorda a Fila do Cortex a cada 15 min, sem usar o banco', async () => {
  const { acordarFila } = require('../../nexia-ai/jobs');
  const env = { NEXIA_JOBS: 'github', NEXIA_JOBS_TOKEN: 'x', NEXIA_JOBS_REPO: 'gilcambe/nexia' };
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push([url, init.method]); return { status: 204 }; };
  const tique = Date.parse('2026-10-07T07:15:00Z');
  assert.deepStrictEqual(await acordarFila({ env, now: () => tique, fetchImpl }), { fila: 'acordada' });
  assert.match(calls[0][0], /actions\/workflows\/fila-cortex\.yml\/dispatches$/);
  assert.deepStrictEqual(await acordarFila({ env, now: () => Date.parse('2026-10-07T07:20:00Z'), fetchImpl }), { fila: 'fora_do_tique' });
  assert.deepStrictEqual(await acordarFila({ env: {}, now: () => tique, fetchImpl }), { fila: 'desligada' });
  assert.strictEqual(calls.length, 1);
});
