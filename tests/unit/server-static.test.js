'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { rawRequest, startServer } = require('../helpers');

const ROOT = path.join(__dirname, '..', '..');

test('server.js não serve arquivos fora das raízes públicas (C1)', async (t) => {
  // Arquivos sensíveis plantados na raiz do repositório durante o teste
  const planted = ['.env', '.env.local'].map(f => path.join(ROOT, f));
  for (const f of planted) if (!fs.existsSync(f)) fs.writeFileSync(f, 'TEST_ONLY=1\n');
  const link = path.join(ROOT, 'core', 'zz-test-symlink.js');
  try { fs.symlinkSync('/etc/hostname', link); } catch {}
  const srv = await startServer();
  t.after(async () => {
    await srv.close();
    for (const f of planted) if (fs.readFileSync(f, 'utf8') === 'TEST_ONLY=1\n') fs.unlinkSync(f);
    try { fs.unlinkSync(link); } catch {}
  });

  const attacks = [
    '/.env', '/.env.local', '/core/.env',
    '/server.js', '/package.json', '/package-lock.json', '/render.yaml', '/firestore.rules',
    '/netlify/functions/middleware.js', '/netlify/functions/firebase-init.js', '/lib/safe-static.js',
    '/../server.js', '/../../etc/passwd', '/../../../../etc/hostname', '/core/../server.js',
    '/core/../../etc/passwd', '/%2e%2e/server.js', '/%2e%2e/%2e%2e/etc/passwd',
    '/core/%2e%2e/server.js', '/%252e%252e/server.js', '/..%2fserver.js', '/core/..%2f..%2fetc/passwd',
    '/..%5c..%5cetc/passwd', '//etc/passwd', '/etc/passwd', '/proc/self/environ',
    '/core/zz-test-symlink.js', '/.git/config', '/NEXIA_OS_MASTER_DOC_v61.md',
  ];
  const hostname = fs.readFileSync('/etc/hostname', 'utf8');
  for (const p of attacks) {
    const r = await rawRequest(srv.port, p);
    assert.ok(!r.body.includes('TEST_ONLY=1'), `${p} vazou .env`);
    assert.ok(!r.body.includes("require('./lib/safe-static')"), `${p} vazou server.js`);
    assert.ok(!r.body.includes('root:x:0:0'), `${p} vazou /etc/passwd`);
    assert.ok(!(hostname.trim() && r.body.trim() === hostname.trim()), `${p} vazou /etc/hostname`);
    assert.ok(!r.body.includes('"dependencies"'), `${p} vazou package.json`);
    assert.ok(!/(^|\0)(PATH|HOME)=/.test(r.body), `${p} vazou variáveis de ambiente`);
    const isSpa = r.status === 200 && /<div id="root"|<!doctype html/i.test(r.body);
    assert.ok(r.status >= 400 || isSpa, `${p} deveria falhar (status ${r.status})`);
    if (/\.(js|json|env|md|yaml|rules|local)$/.test(p)) assert.ok(r.status >= 400, `${p} deveria ser 4xx, veio ${r.status}`);
  }

  // Arquivos públicos legítimos continuam acessíveis
  const ok = await rawRequest(srv.port, '/core/auth.js');
  assert.strictEqual(ok.status, 200);
  const landing = await rawRequest(srv.port, '/ces/landing');
  assert.strictEqual(landing.status, 200);
  const post = await rawRequest(srv.port, '/core/auth.js', { method: 'POST' });
  assert.strictEqual(post.status, 405);
});

test('erro interno de função não expõe detalhes (A5)', async (t) => {
  const srv = await startServer();
  t.after(() => srv.close());
  // Função inexistente → 404 genérico
  const r = await rawRequest(srv.port, '/.netlify/functions/nao-existe');
  assert.strictEqual(r.status, 404);
  assert.ok(!/stack|at \w+ \(|\/home\/|node_modules/.test(r.body));
});
