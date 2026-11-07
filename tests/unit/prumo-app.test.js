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
  assert.equal(m.name, 'Kernex Finance'); // o Fortune virou Kernex Finance (pasta e API seguem /prumo)
  assert.equal(m.start_url, '/prumo/');
  assert.ok(m.icons.some((i) => i.src.endsWith('icone.svg')));
});

test('PA2. ícone é azul com K e sem NEXIA', () => {
  const svg = ler('icone.svg');
  assert.match(svg, />K</);
  assert.match(svg, /#2f6bff/);
  assert.doesNotMatch(svg, /nexia/i);
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

test('PA7. marca Kernex Finance: nenhum texto visível com Nexia ou Fortune', () => {
  for (const f of ['index.html', 'landing.html', 'manifest.webmanifest', 'instalar.js']) {
    const t = ler(f).replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[^>]*src[^>]*><\/script>/g, '');
    assert.doesNotMatch(t, /nexia|fortune/i, f);
  }
  assert.match(ler('index.html'), /<title>Kernex Finance<\/title>/);
});

test('PA8. landing aponta para o app, e /kernex-finance e /fortune abrem a landing', () => {
  assert.match(ler('landing.html'), /href="\/prumo\/"/);
  const { TENANT_PAGES: T } = require('../../lib/routes');
  assert.deepEqual(T['/kernex-finance'], ['prumo', 'landing.html']);
  assert.deepEqual(T['/fortune'], ['prumo', 'landing.html']);
});

test('PA9. modo privacidade: botão, script no service worker e estilo', () => {
  assert.match(ler('index.html'), /id="olho"/);
  assert.match(ler('index.html'), /body\.privado \.valor/);
  assert.match(ler('sw.js'), /privacidade\.js/);
  assert.match(ler('sw.js'), /v16-kernexfinance/);
});

test('PA10. abas Início e Documentos: no menu, no app e no service worker, com os arquivos existindo', () => {
  const html = ler('index.html');
  for (const a of ['inicio', 'documentos', 'contas', 'cartoes', 'dividas', 'investimentos', 'economizar', 'metas', 'assistente']) { assert.match(html, new RegExp(`data-aba="${a}"`)); assert.match(ler('app.js'), new RegExp(`'${a}'`)); assert.match(ler('sw.js'), new RegExp(`/prumo/${a}\\.js`)); assert.match(ler(`${a}.js`), new RegExp(`MB\\.telas\\.${a} =`)); }
  assert.match(ler('documentos.js'), /doc_ler/);
  assert.match(ler('documentos.js'), /doc_confirmar/);
  assert.match(ler('inicio.js'), /inicio_resumo/);
});
