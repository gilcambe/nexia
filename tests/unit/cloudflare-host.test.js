'use strict';
// ADR-FREE-01/02: hospedagem só no plano grátis (Cloudflare Worker + Firebase Spark + GitHub Actions).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { handleRequest, populateProcessEnv, MAX_BODY_SIZE } = require('../../cloudflare/app');
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
const FILES = { '/index.html': 'SPA', '/assets/app-1.js': 'js', '/ces/ces-landing.html': 'CES' };
const call = (url, init = {}, env = {}, getFunction = () => null) =>
  handleRequest(new Request('https://nexia.test' + url, init), { ASSETS: fakeAssets(FILES), ...env }, { getFunction });

test('CF1. config do Worker: plano grátis, sem Container/Durable Object, cron de hora em hora, sem Render', () => {
  const wr = readWrangler();
  assert.strictEqual(wr.main, 'cloudflare/worker.js');
  assert.strictEqual(wr.containers, undefined, 'Container exige Workers Paid');
  assert.strictEqual(wr.durable_objects, undefined);
  assert.deepStrictEqual(wr.triggers.crons, ['7 * * * *']);
  assert.strictEqual(wr.assets.binding, 'ASSETS');
  assert.ok(!fs.existsSync(path.join(ROOT, 'Dockerfile')));
  assert.ok(!fs.existsSync(path.join(ROOT, 'render.yaml')));
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  for (const dep of ['firebase-admin', '@cloudflare/containers']) {
    assert.ok(!(pkg.dependencies || {})[dep] && !(pkg.devDependencies || {})[dep], dep);
  }
  const deploy = fs.readFileSync(path.join(ROOT, '.github/workflows/deploy-cloudflare.yml'), 'utf8');
  assert.match(deploy, /^on:\n  workflow_dispatch:/m, 'deploy só manual');
  assert.doesNotMatch(deploy, /^\s+(push|pull_request|schedule):/m);
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
    .filter(f => f.endsWith('.js') && !['firebase-init.js', 'middleware.js'].includes(f)).map(f => f.slice(0, -3));
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

test('CF7. cron do Worker só dispara a retomada quando há execução parada há mais de 10 min', async () => {
  const now = Date.parse('2026-10-04T12:00:00Z');
  const fakeDb = rows => ({ collection: () => ({ where: () => ({ limit: () => ({ get: async () => ({ docs: rows.map(r => ({ data: () => r })) }) }) }) }) });
  const sent = [];
  const jobs = { enabled: true, dispatch: async j => { sent.push(j); return { queued: true }; } };
  assert.deepStrictEqual(await scheduledSweep({ db: fakeDb([{ updated_at: '2026-10-04T11:55:00Z' }]), jobs, now: () => now }), { stale: 0 });
  assert.deepStrictEqual(await scheduledSweep({ db: fakeDb([{ updated_at: Timestamp.fromMillis(now - 11 * 60000) }, { updated_at: '2026-10-04T10:00:00Z', deleted_at: 'x' }]), jobs, now: () => now }), { stale: 1, queued: true });
  assert.deepStrictEqual(sent, [{ kind: 'sweep' }]);
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

test('CF9. deploy copia ao Worker só os segredos que o NEXIA usa; nunca o token temporário do Actions nem o do Cloudflare', () => {
  const { pickWorkerSecrets } = require('../../scripts/worker-secrets');
  const got = pickWorkerSecrets({ FIREBASE_SERVICE_ACCOUNT_BASE64: 'a', GEMINI_API_KEY: 'b', NEXIA_JOBS_TOKEN: 'c', MASTER_EMAIL: 'd',
    github_token: 'e', GITHUB_TOKEN: 'f', CLOUDFLARE_API_TOKEN: 'g', RANDOM_THING: 'h', GITHUB_APP_ID: 'i', EMPTY_API_KEY: '' });
  assert.deepStrictEqual(Object.keys(got).sort(), ['FIREBASE_SERVICE_ACCOUNT_BASE64', 'GEMINI_API_KEY', 'GITHUB_APP_ID', 'MASTER_EMAIL', 'NEXIA_JOBS_TOKEN']);
});
