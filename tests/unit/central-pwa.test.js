'use strict';
// #1288: Central instalável no celular (manifesto próprio, service worker sem /api e /__/, só em /central).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ler = (p) => fs.readFileSync(path.join(__dirname, '../..', p), 'utf8');

test('CENTRAL-PWA1: manifesto da Central', () => {
  const m = JSON.parse(ler('public/central.webmanifest'));
  assert.equal(m.name, 'Central Kernex');
  assert.equal(m.start_url, '/central');
  assert.equal(m.scope, '/central');
  assert.equal(m.display, 'standalone');
  for (const i of m.icons) assert.ok(fs.existsSync(path.join(__dirname, '../../public', i.src)), i.src);
});

test('CENTRAL-PWA2: service worker não guarda /api nem /__/', () => {
  const sw = ler('public/central-sw.js');
  assert.match(sw, /startsWith\("\/api\/"\)/);
  assert.match(sw, /startsWith\("\/__\/"\)/);
});

test('CENTRAL-PWA3: registro só em /central, botão de instalar e aba PRs', () => {
  assert.match(ler('index.html'), /indexOf\("\/central"\)===0[^]*central-sw\.js/);
  assert.match(ler('src/pages/central/InstalarApp.tsx'), /Instalar no celular[^]*Adicionar à Tela de Início/);
  assert.match(ler('src/pages/central/page.tsx'), /id: "prs"/);
});
