'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { normalizeRequestPath, resolveStatic } = require('../../lib/safe-static');

test('normalizeRequestPath rejeita traversal, encodings e arquivos ocultos', () => {
  const bad = [
    '/../server.js', '/../../etc/passwd', '/core/../server.js', '/core/./auth.js',
    '/%2e%2e/server.js', '/%2E%2E/%2E%2E/etc/passwd', '/core/%2e%2e/server.js',
    '/%252e%252e/server.js', '/..%2fserver.js', '/core%2f..%2fserver.js', '/..%5cserver.js',
    '/.env', '/.env.local', '/core/.env', '/.git/config', '/%2eenv', '/x%00.js', '/a\\..\\b.js',
    'relative/path', '/%E0%A4%A',
  ];
  for (const p of bad) assert.strictEqual(normalizeRequestPath(p), null, p);
  assert.strictEqual(normalizeRequestPath('/core/auth.js'), '/core/auth.js');
  assert.strictEqual(normalizeRequestPath('/ces/landing/'), '/ces/landing');
  assert.strictEqual(normalizeRequestPath('/'), '/');
});

test('resolveStatic só devolve arquivos dentro da raiz, com extensão permitida e sem symlink para fora', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexia-static-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'nexia-outside-'));
  fs.writeFileSync(path.join(root, 'ok.js'), 'ok');
  fs.writeFileSync(path.join(root, 'secret.env'), 'X=1');
  fs.writeFileSync(path.join(outside, 'leak.js'), 'leak');
  fs.symlinkSync(path.join(outside, 'leak.js'), path.join(root, 'link.js'));
  fs.mkdirSync(path.join(root, 'dir.js'));
  try {
    assert.ok(resolveStatic(root, 'ok.js'));
    assert.strictEqual(resolveStatic(root, 'secret.env'), null, 'extensão fora da allowlist');
    assert.strictEqual(resolveStatic(root, 'link.js'), null, 'symlink para fora da raiz');
    assert.strictEqual(resolveStatic(root, '../' + path.basename(outside) + '/leak.js'), null, 'traversal');
    assert.strictEqual(resolveStatic(root, path.join(outside, 'leak.js')), null, 'caminho absoluto');
    assert.strictEqual(resolveStatic(root, 'dir.js'), null, 'diretório');
    assert.strictEqual(resolveStatic(root, 'nao-existe.js'), null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});
