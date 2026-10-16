'use strict';
// Trava do Cortex (2026-10-15): só o dono usa o chat, o agente, a memória, os logs e o aprendizado do Cortex.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

delete process.env.FIREBASE_SERVICE_ACCOUNT;
delete process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
delete process.env.FIRESTORE_EMULATOR_HOST;
const mw = require('../../netlify/functions/middleware');

const antes = { m: process.env.MASTER_EMAIL, l: process.env.CORTEX_EMAILS_PERMITIDOS, t: process.env.CORTEX_SOMENTE_DONO };
test.afterEach(() => {
  for (const [k, v] of [['MASTER_EMAIL', antes.m], ['CORTEX_EMAILS_PERMITIDOS', antes.l], ['CORTEX_SOMENTE_DONO', antes.t]]) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});

const tk = (o = {}) => ({ ok: true, uid: 'u1', email: 'x@y.com', emailVerified: true, role: 'user', ...o });

test('TC1. usuário comum, convidado e admin de tenant não passam', () => {
  delete process.env.CORTEX_SOMENTE_DONO;
  for (const role of ['user', 'member', 'manager', 'admin', 'guest']) assert.strictEqual(mw.podeUsarCortex(tk({ role })), false, role);
});

test('TC2. master passa; token inválido não passa', () => {
  assert.strictEqual(mw.podeUsarCortex(tk({ role: 'master' })), true);
  assert.strictEqual(mw.podeUsarCortex({ ok: false }), false);
  assert.strictEqual(mw.podeUsarCortex(null), false);
});

test('TC3. MASTER_EMAIL só vale com e-mail verificado', () => {
  process.env.MASTER_EMAIL = 'dono@exemplo.com';
  assert.strictEqual(mw.podeUsarCortex(tk({ email: 'DONO@exemplo.com', emailVerified: true })), true);
  assert.strictEqual(mw.podeUsarCortex(tk({ email: 'dono@exemplo.com', emailVerified: false })), false);
  assert.strictEqual(mw.podeUsarCortex(tk({ email: 'outro@exemplo.com', emailVerified: true })), false);
});

test('TC4. e-mail do master não verificado, ou de outra pessoa, nunca passa (mesmo com a lista antiga)', () => {
  process.env.MASTER_EMAIL = 'dono@exemplo.com';
  process.env.CORTEX_EMAILS_PERMITIDOS = 'outro@x.com';
  assert.strictEqual(mw.podeUsarCortex(tk({ email: 'dono@exemplo.com', emailVerified: undefined })), false);
  assert.strictEqual(mw.podeUsarCortex(tk({ email: 'outro@x.com', emailVerified: true })), false);
});

test('TC5. CORTEX_SOMENTE_DONO=0 desliga a trava', () => {
  process.env.CORTEX_SOMENTE_DONO = '0';
  assert.strictEqual(mw.podeUsarCortex(tk({ role: 'user' })), true);
});

test('TC6. as cinco funções do Cortex pedem cortexOnly e sem token continuam em 401', async () => {
  for (const f of ['cortex-chat', 'cortex-agent', 'cortex-logs', 'cortex-memory', 'cortex-learn']) {
    const src = fs.readFileSync(path.join(__dirname, '../../netlify/functions', f + '.js'), 'utf8');
    assert.match(src, /guard\(event, '[\w-]+'[^)]*cortexOnly: true/, f);
  }
  const r = await mw.guard({ httpMethod: 'POST', headers: {}, body: '{}' }, 'cortex-chat', { cortexOnly: true });
  assert.strictEqual(r.statusCode, 401);
});
