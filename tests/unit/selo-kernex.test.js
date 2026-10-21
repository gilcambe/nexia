'use strict';
// Marca Kernex (#999, #1000, #1002): selo "Feito com Kernex" nos sites no ar e CONTEXTO-IA.md com a marca.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, '..', '..', p), 'utf8');

const SITES = {
  bezsan: ['sites/bezsan/index.html', 'sites/bezsan/agenda/index.html'],
  achados: ['afiliados/lib/site.js'],
  studiolima: ['sites/studiolima/index.html', 'sites/studiolima/agenda/index.html', 'sites/studiolima/privacidade.html'],
  splash: ['sites/splash/index.html'],
};

test('SELO-KERNEX: Bezsan, Achados e Studio Lima trocaram "Feito com NEXIA" pelo selo com link e utm do site', () => {
  for (const [slug, arquivos] of Object.entries(SITES)) {
    for (const f of arquivos) {
      const fullPath = path.join(__dirname, '..', '..', f);
      if (!fs.existsSync(fullPath)) continue;
      const s = fs.readFileSync(fullPath, 'utf8');
      assert.doesNotMatch(s, /Feito com NEXIA/, f);
      assert.ok(s.includes(`kernex.com.br/?utm_source=${slug}&amp;utm_medium=selo&amp;utm_campaign=clientes`), f);
      assert.match(s, /target="_blank" rel="noopener"[^>]*>Feito com Kernex<\/a>/, f);
    }
  }
});

test('CONTEXTO-KERNEX: CONTEXTO-IA.md fala da marca Kernex, dos clientes antigos e não tem chaves', () => {
  const s = R('docs/CONTEXTO-IA.md');
  assert.match(s, /Kernex/);
  assert.match(s, /Feito com Kernex/);
  assert.match(s, /Inteligência que resolve\./);
  for (const c of ['/ces', '/vp', '/splash']) assert.ok(s.includes(c), c);
  assert.doesNotMatch(s, /sk-[A-Za-z0-9]{10}|AIza[0-9A-Za-z_-]{10}|ghp_[A-Za-z0-9]{10}/);
});
