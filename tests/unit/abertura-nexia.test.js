'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, '..', '..', p), 'utf8');

test('ABERTURA-SYNC: a abertura NEXIA do Cortex é igual à do Body Coach e aceita o nome do produto', () => {
  const bc = R('apps/body-coach/src/abertura.ts');
  assert.strictEqual(R('src/lib/abertura-nexia.ts'), bc);
  assert.match(bc, /mostrarAbertura\(produto = 'BODY COACH'\)/);
  assert.match(R('src/pages/cortex/page.tsx'), /mostrarAbertura\("CORTEX"\)/);
});

test('ABERTURA-PWA: manifesto do Cortex instalável sem barra do navegador (standalone, PNG 192/512 e maskable, preto)', () => {
  const m = JSON.parse(R('public/cortex.webmanifest'));
  assert.strictEqual(m.display, 'standalone');
  assert.strictEqual(m.background_color, '#000000');
  assert.strictEqual(m.theme_color, '#000000');
  assert.ok(m.start_url.startsWith(m.scope));
  const ic = m.icons;
  for (const [s, p] of [['192x192', 'any'], ['512x512', 'any'], ['512x512', 'maskable']]) {
    const i = ic.find(x => x.sizes === s && x.purpose === p && x.type === 'image/png');
    assert.ok(i, `${s} ${p}`);
    assert.ok(fs.existsSync(path.join(__dirname, '..', '..', 'public', i.src)), i.src);
  }
  assert.match(R('index.html'), /rel="manifest" href="\/cortex\.webmanifest"/);
});
