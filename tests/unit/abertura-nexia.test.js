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

test('ABERTURA-KERNEX: vinheta mostra KERNEX, símbolo inline e frase, sem NEXIA visível, em até 2 s', () => {
  const src = R('src/lib/abertura-nexia.ts');
  assert.match(src, /MARCA_ABERTURA = 'KERNEX'/);
  assert.match(src, /FRASE_ABERTURA = 'Inteligência que resolve\.'/);
  assert.match(src, /SIMBOLO_KERNEX_SVG =\s*\n\s*'<svg/);
  assert.match(src, /background:#060d1c/);
  // o HTML montado (htmlAbertura) não tem o texto NEXIA visível
  const html = src.slice(src.indexOf('export function htmlAbertura'), src.indexOf('export function mostrarAbertura'));
  assert.ok(html.length > 50);
  assert.doesNotMatch(html, /NEXIA/);
  assert.doesNotMatch(src, /'NEXIA'\.split/);
  const dur = Number((src.match(/DURACAO_ABERTURA_MS = (\d+)/) || [])[1]);
  assert.ok(dur > 0 && dur <= 2000, 'duração <= 2000 ms');
  assert.match(src, /sessionStorage\.getItem\('nexia_splash'\)/);
});
