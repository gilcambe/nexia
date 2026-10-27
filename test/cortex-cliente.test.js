import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { Miniflare } from 'miniflare';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret-key-for-jwt-signing';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = JWT_SECRET;

function generateTestToken(uid) {
  return jwt.sign(
    { uid, type: 'access', exp: Math.floor(Date.now() / 1000) + (60 * 60) },
    JWT_SECRET
  );
}

const uidAToken = generateTestToken('uidA');
const uidBToken = generateTestToken('uidB');

let mf;
let baseUrl;

before(async () => {
  mf = new Miniflare({
    modules: true,
    script: `
      import app from './cloudflare/app.js';
      import functions from './cloudflare/functions.js';
      
      export default {
        async fetch(request, env, ctx) {
          return app.handleRequest(request, env, { getFunction: functions.getFunction });
        }
      };
    `,
    modulesRules: [
      { type: 'ESModule', include: ['**/*.js'] }
    ],
    compatibilityDate: '2024-01-01',
    bindings: {
      NODE_ENV: 'test',
      JWT_SECRET: JWT_SECRET
    }
  });

  const url = await mf.ready;
  baseUrl = url.toString().replace(/\\/$/, '');
});

after(async () => {
  if (mf) {
    await mf.dispose();
  }
});

test('GET /api/cortex-cliente/conversas com uidA retorna 200 e dados do uidA', async () => {
  const res = await fetch(`${baseUrl}/api/cortex-cliente/conversas`, {
    headers: {
      'Authorization': `Bearer ${uidAToken}`
    }
  });

  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.uid, 'uidA');
  assert.ok(Array.isArray(data.conversas));
});

test('GET /api/cortex-cliente/conversas com uidB retorna 403', async () => {
  const res = await fetch(`${baseUrl}/api/cortex-cliente/conversas`, {
    headers: {
      'Authorization': `Bearer ${uidBToken}`
    }
  });

  assert.strictEqual(res.status, 403);
  const data = await res.json();
  assert.strictEqual(data.error, 'Forbidden');
});

test('GET /api/cortex-cliente/conversas sem Authorization retorna 401', async () => {
  const res = await fetch(`${baseUrl}/api/cortex-cliente/conversas`);

  assert.strictEqual(res.status, 401);
  const data = await res.json();
  assert.strictEqual(data.error, 'Unauthorized');
});
