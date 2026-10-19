'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const b = require('../../scripts/bundle-budget.js');

test('BB1. acha script de entrada e modulepreload, sem duplicar e sem ld+json', () => {
  const html = '<script type="application/ld+json">{}</script><script>x</script>' +
    '<script type="module" crossorigin src="/assets/index-a.js"></script>' +
    '<link rel="modulepreload" crossorigin href="/assets/vendor-react-b.js">' +
    '<link rel="modulepreload" href="/assets/index-a.js"><link rel="stylesheet" href="/assets/x.css">';
  assert.deepStrictEqual(b.jsIniciais(html), ['/assets/index-a.js', '/assets/vendor-react-b.js']);
});

test('BB2. conferir respeita o limite em KB', () => {
  assert.strictEqual(b.conferir([{ gzip: 1024 }, { gzip: 1024 }], 2).ok, true);
  assert.strictEqual(b.conferir([{ gzip: 1024 }, { gzip: 1025 }], 2).ok, false);
});

test('BB3. medir lê os arquivos do build e calcula gzip', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'assets', 'index-a.js'), 'console.log(1);'.repeat(200));
  fs.writeFileSync(path.join(dir, 'index.html'), '<script type="module" src="/assets/index-a.js"></script>');
  const [a] = b.medir(dir);
  assert.strictEqual(a.nome, 'assets/index-a.js');
  assert.strictEqual(a.bytes, 3000);
  assert.ok(a.gzip > 0 && a.gzip < a.bytes);
});

test('BB4. limite padrão cabe no build de hoje com folga pequena', () => {
  assert.ok(b.LIMITE_PADRAO_KB >= 120 && b.LIMITE_PADRAO_KB <= 200);
});
