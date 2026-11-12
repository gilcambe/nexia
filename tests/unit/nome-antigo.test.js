'use strict';
// K5 (#3571): detector de nome antigo visível ao cliente. Um teste por regra da issue.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { achar, listarVisiveis } = require('../../scripts/nome-antigo');
const n = (t, c = 'a.tsx') => achar(t, c).length;

test('NA1. casos da issue', () => {
  assert.equal(n('<title>NEXIA Cortex</title>', 'a.html'), 1);
  assert.equal(n("const nexia = require('../nexia-ai/x')", 'a.js'), 0);
  assert.equal(n('<a href="https://nexiabodycoach.pages.dev">', 'a.tsx'), 1);
  assert.equal(n('<p>Feito com Kernex</p>'), 0);
  assert.equal(n('<p>Feito com NEXIA</p> // nome-antigo:permitido'), 0);
});

test('NA2. texto entre tags, nas duas grafias e no Prumo', () => {
  assert.equal(n('<p>Bem-vindo à Nexia</p>'), 1);
  assert.equal(n('<h1>PRUMO</h1>'), 1);
  assert.equal(n('<span>{"Suporte NEXIA"}</span>'), 1);
});

test('NA3. atributos que aparecem: alt, title, placeholder, aria-label', () => {
  assert.equal(n('<img alt="Logo NEXIA" src="/x.png">'), 1);
  assert.equal(n('<input placeholder="Buscar no Prumo">'), 1);
  assert.equal(n('<button aria-label="Abrir nexia">'), 1);
  assert.equal(n('<div title={"NEXIA"} />'), 1);
});

test('NA4. metas de título e descrição', () => {
  assert.equal(n('<meta property="og:title" content="NEXIA Body Coach">', 'a.html'), 1);
  assert.equal(n('<meta name="description" content="App do Prumo">', 'a.html'), 1);
  assert.equal(n('<meta name="viewport" content="width=device-width">', 'a.html'), 0);
});

test('NA5. todos os endereços antigos visíveis', () => {
  assert.equal(n('<a href="https://nexia.gcbezerra.workers.dev/central">'), 1);
  assert.equal(n('<a href="https://nexiaos.com.br">site</a>'), 1);
  assert.equal(n('<p>Acesse nexia.app</p>'), 1);
  assert.equal(n('<meta property="og:url" content="https://nexiabodycoach.pages.dev/x">', 'a.html'), 1);
});

test('NA6. nome interno não conta: caminho, variável, chave, rota /api/nexia/, comentário', () => {
  assert.equal(n("import x from '@/nexia-ai/router';"), 0);
  assert.equal(n('const CHAVE = "nexia_agenda_" + SITE;'), 0);
  assert.equal(n('const o = { nexia: 1, prumo: 2 };'), 0);
  assert.equal(n('fetch("/api/nexia/maquinas")'), 0);
  assert.equal(n('<p>Ver /api/nexia/maquinas</p>'), 0);
  assert.equal(n('// NEXIA: comentário de código'), 0);
  assert.equal(n('<!-- NEXIA Agenda: painel -->', 'a.html'), 0);
  assert.equal(n('/* Prumo antigo */ const a = 1;'), 0);
});

test('NA7. devolve linha e trecho; mesma palavra repetida na linha conta uma vez', () => {
  assert.deepEqual(achar('<p>ok</p>\n<p>NEXIA e NEXIA</p>', 'a.html'), [{ linha: 2, trecho: 'NEXIA' }]);
});

test('NA8. listarVisiveis varre só as pastas do cliente', () => {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'na-'));
  const escreve = (rel, t) => { fs.mkdirSync(path.dirname(path.join(r, rel)), { recursive: true }); fs.writeFileSync(path.join(r, rel), t); };
  escreve('src/pages/a.tsx', 'export default () => <h1>NEXIA</h1>;');
  escreve('src/components/b.tsx', '<p>Kernex</p>');
  escreve('apps/body-coach/src/c.tsx', '<img alt="nexia" />');
  escreve('apps/body-coach/node_modules/d.js', '<p>NEXIA</p>');
  escreve('public/e.html', '<title>Prumo</title>');
  escreve('public/f.js', '<p>NEXIA</p>');
  escreve('netlify/functions/g.js', '<p>NEXIA</p>');
  escreve('scripts/h.js', '<p>NEXIA</p>');
  const lista = listarVisiveis(r).map((x) => `${x.arquivo}:${x.linha}`).sort();
  assert.deepEqual(lista, ['apps/body-coach/src/c.tsx:1', 'public/e.html:1', 'src/pages/a.tsx:1']);
});

test('NA-CI. guarda: nada com o nome antigo visível ao cliente no repositório (C/#3571 fechado em 12/11)', () => {
  const path = require('node:path');
  const { listarVisiveis } = require('../../scripts/nome-antigo');
  const achados = listarVisiveis(path.join(__dirname, '..', '..'));
  assert.deepEqual(achados.map(a => `${a.arquivo || a.caminho}:${a.linha} ${a.trecho}`), []);
});
