'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { checkWebFiles, resolveRef } = require('../../nexia-ai/orchestrator/web-check');

const page = body => `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>T</title>
<link rel="stylesheet" href="styles.css"></head><body>${body}<script src="script.js"></script></body></html>`;
const ok = [{ path: 'demo/styles.css', content: 'a { color: red; }' }, { path: 'demo/script.js', content: 'document.title = "x";' }];

test('W1. HTML válido, com <li>/<p> sem fechar (permitido), não gera erro', () => {
  const r = checkWebFiles([{ path: 'demo/index.html', content: page('<nav><ul><li><a href="#a">A</a><li>B</ul></nav><main id="a"><p>um<p>dois<img src="logo.svg" alt="Logo" width="10" height="10"></main>') }, ...ok,
    { path: 'demo/logo.svg', content: '<svg/>' }]);
  assert.deepStrictEqual(r.errors, []);
  assert.deepStrictEqual(r.missingCandidates, []);
});

test('W2. pega o que o Cortex errou de verdade: tag trocada por aspas, img sem alt, âncora sem alvo, arquivo inexistente', () => {
  const html = page('<form><div><label for="n">Nome</label><input id="n">\n"\n<div><input id="e" aria-label="E-mail"></div></form><img src="hero.jpg"><a href="#contato">c</a>');
  const r = checkWebFiles([{ path: 'demo/index.html', content: html }, ...ok]);
  const msgs = r.errors.map(e => e.message).join(' | ');
  assert.match(msgs, /texto solto "/);
  assert.match(msgs, /<\/form> fecha <div>/);
  assert.match(msgs, /<img> sem alt/);
  assert.match(msgs, /#contato/);
  assert.deepStrictEqual(r.missingCandidates.map(m => m.path), ['demo/hero.jpg']);
});

test('W3. CSS com chave sobrando/faltando e JS que não compila', () => {
  const r = checkWebFiles([{ path: 'a.css', content: 'a { color: red; }\n}\n.b { content: "{"; ' }, { path: 'a.js', content: 'function x( {' },
    { path: 'm.js', content: 'import x from "./x.js";\nexport default x;' }]);
  const got = r.errors.map(e => `${e.file} ${e.message}`);
  assert.strictEqual(got.length, 3, got.join(' | '));
  assert.match(got[0], /^a\.css "}" sobrando/);
  assert.match(got[1], /^a\.css 1 bloco\(s\) do CSS sem/);
  assert.match(got[2], /^a\.js JavaScript não compila/);
});

test('W4. avisos não bloqueiam: campo sem label, botão desabilitado, link vazio, img sem tamanho', () => {
  const r = checkWebFiles([{ path: 'i.html', content: page('<input id="q"><button type="submit" disabled>Ir</button><a href="#">x</a><img src="https://x.com/a.png" alt="">') }, ...ok.map(f => ({ ...f, path: f.path.replace('demo/', '') }))]);
  assert.deepStrictEqual(r.errors, []);
  assert.strictEqual(r.warnings.length, 4);
});

test('W5. resolveRef: relativo, ../, absoluto do repo e externos', () => {
  assert.strictEqual(resolveRef('demos/x/index.html', 'img/a.png?v=2'), 'demos/x/img/a.png');
  assert.strictEqual(resolveRef('demos/x/index.html', '../y/b.css'), 'demos/y/b.css');
  assert.strictEqual(resolveRef('demos/x/index.html', '/c.js'), 'c.js');
  for (const ext of ['https://a.com/x.png', '//cdn/x.js', 'mailto:a@b.c', 'tel:1', '#topo', 'data:image/png;base64,AA']) assert.strictEqual(resolveRef('i.html', ext), null, ext);
});
