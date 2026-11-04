'use strict';
// Prumo #2928 (partes #2944-#2948): casca PWA em /prumo/.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { PUBLIC_DIRS, TENANT_PAGES, API_ROUTES } = require('../../lib/routes');

const pasta = path.join(__dirname, '..', '..', 'prumo');
const ler = (f) => fs.readFileSync(path.join(pasta, f), 'utf8');

test('PA1. manifest: name Prumo, start_url /prumo/, ícone próprio', () => {
  const m = JSON.parse(ler('manifest.webmanifest'));
  assert.equal(m.name, 'Fortune'); // #2923: o app se chama Fortune (pasta e API seguem /prumo)
  assert.equal(m.start_url, '/prumo/');
  assert.ok(m.icons.some((i) => i.src.endsWith('icone.svg')));
});

test('PA2. ícone é verde com P e sem NEXIA/Kernex', () => {
  const svg = ler('icone.svg');
  assert.match(svg, />F</);
  assert.match(svg, /#16a34a/);
  assert.doesNotMatch(svg, /nexia|kernex/i);
});

test('PA3. tela mostra Entrar com Google, 3+ abas e o rodapé de privacidade', () => {
  const html = ler('index.html');
  assert.match(html, /Entrar com Google/);
  for (const a of ['carteira', 'gastos', 'compras']) assert.match(html, new RegExp(`data-aba="${a}"`));
  assert.match(html, /O app nunca pede senha de banco/);
  assert.match(html, /firebasejs\/10\.\d+\.\d+\/firebase-auth-compat\.js/);
});

test('PA4. app chama /api/prumo com Bearer, pede avisos e mostra Em breve sem a aba', () => {
  const js = ler('app.js');
  assert.match(js, /\/api\/prumo/);
  assert.match(js, /Authorization: 'Bearer '/);
  assert.match(js, /api\('avisos'\)/);
  assert.match(js, /Em breve/);
  assert.match(js, /window\.MB = \{ api/);
});

test('PA5. service worker não guarda respostas da API', () => {
  const sw = ler('sw.js');
  assert.match(sw, /startsWith\('\/prumo\/'\)/);
  assert.doesNotMatch(sw, /\/api\//);
});

test('PA6. rotas: pasta pública, página /prumo e API', () => {
  assert.ok(PUBLIC_DIRS.includes('prumo'));
  assert.deepEqual(TENANT_PAGES['/prumo'], ['prumo', 'index.html']);
  assert.equal(API_ROUTES['/api/prumo'], 'prumo');
});
