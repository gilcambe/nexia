'use strict';
// ADR-HOST-01: hospedagem só Cloudflare + Firebase + GitHub. Nada de Render no que roda.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { containerEnv, cronRequest } = require('../../cloudflare/env');

const ROOT = path.join(__dirname, '..', '..');

test('CF1. Worker repassa ao container só variáveis de texto, com PORT 8080', () => {
  const env = { FIREBASE_PROJECT_ID: 'demo', ANTHROPIC_API_KEY: 'x', NEXIA_BACKEND: { idFromName() {} }, ASSETS: {}, 'bad-name': 'y', NUM: 3 };
  assert.deepStrictEqual(containerEnv(env), { FIREBASE_PROJECT_ID: 'demo', ANTHROPIC_API_KEY: 'x', PORT: '8080', NODE_ENV: 'production' });
  assert.strictEqual(containerEnv({ NODE_ENV: 'staging' }).NODE_ENV, 'staging');
});

test('CF2. config do Cloudflare aponta para o container; sem Render no que é executado', () => {
  const wr = JSON.parse(fs.readFileSync(path.join(ROOT, 'wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, ''));
  assert.strictEqual(wr.main, 'cloudflare/worker.js');
  assert.deepStrictEqual([wr.containers[0].class_name, wr.containers[0].image, wr.containers[0].max_instances], ['NexiaBackend', './Dockerfile', 1]);
  assert.strictEqual(wr.durable_objects.bindings[0].class_name, 'NexiaBackend');
  assert.ok(!fs.existsSync(path.join(ROOT, 'render.yaml')));
  const deploy = fs.readFileSync(path.join(ROOT, '.github/workflows/deploy-cloudflare.yml'), 'utf8');
  assert.match(deploy, /^on:\n  workflow_dispatch:/m, 'deploy só manual');
  assert.doesNotMatch(deploy, /^\s+(push|pull_request|schedule):/m);
  for (const f of ['server.js', 'src/config/env.ts', 'index.html', 'netlify/functions/sentinel.js', 'src/pages/tenant/page.tsx', 'ces/ces-app-executivo.html']) {
    assert.doesNotMatch(fs.readFileSync(path.join(ROOT, f), 'utf8'), /onrender\.com|RENDER_EXTERNAL_URL/, f);
  }
});

test('CF3. Cron do Worker: sem segredo forte não chama nada; com segredo, POST interno com o cabeçalho', async () => {
  assert.strictEqual(cronRequest({}), null);
  assert.strictEqual(cronRequest({ NEXIA_CRON_SECRET: 'curto' }), null);
  const r = cronRequest({ NEXIA_CRON_SECRET: 'x'.repeat(40) });
  assert.deepStrictEqual([r.method, new URL(r.url).pathname, r.headers.get('x-nexia-cron')], ['POST', '/api/nexia/internal/sweep', 'x'.repeat(40)]);
  const wr = JSON.parse(fs.readFileSync(path.join(ROOT, 'wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, ''));
  assert.deepStrictEqual(wr.triggers.crons, ['7 * * * *']);
});
