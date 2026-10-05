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

test('W6. ADR-Q-03: página nova de site sem fonte da web, sem movimento e sem fotos é reprovada; a completa passa', () => {
  const { checkWebFiles } = require('../../nexia-ai/orchestrator/web-check');
  const added = new Set(['s/index.html', 's/styles.css', 's/script.js']);
  const weak = checkWebFiles([{ path: 's/index.html', content: page('<header></header><main><img src="https://x/a.jpg" alt="a" width="1" height="1"></main><footer></footer>') },
    { path: 's/styles.css', content: 'a { color: red; }' }, { path: 's/script.js', content: '' }], { design: 'site', added });
  const msgs = weak.errors.map(e => e.message).join(' | ');
  for (const re of [/fonte da web/, /:root/, /@media/, /movimento/, /só 1 foto/]) assert.match(msgs, re);
  assert.deepStrictEqual(weak.externalMedia.map(m => m.url), ['https://x/a.jpg']);

  const imgs = [1, 2, 3].map(n => `<img src="https://x/${n}.jpg" alt="foto ${n}" width="4" height="3">`).join('');
  const good = checkWebFiles([
    { path: 's/index.html', content: page(`<header><link href="https://fonts.googleapis.com/css2?family=Fraunces&display=swap" rel="stylesheet"></header><main class="hero">${imgs}</main><footer></footer>`) },
    { path: 's/styles.css', content: ':root { --primary: #6b3; }\n.hero { background: url("https://x/hero.jpg"); transition: opacity .3s; }\n@media (max-width: 700px) { .hero { padding: 0; } }' },
    { path: 's/script.js', content: 'new IntersectionObserver(() => {});' }], { design: 'site', added });
  assert.deepStrictEqual(good.errors, []);
  assert.strictEqual(good.externalMedia.length, 4);
  // Página que já existia (mudança pontual) não passa pela checagem visual.
  assert.deepStrictEqual(checkWebFiles([{ path: 's/index.html', content: page('<p>x</p>') }], { design: 'site', added: new Set() }).errors, []);
});

test('W7. sistema novo precisa de menu (nav/aside), mas não de fotos', () => {
  const { checkWebFiles } = require('../../nexia-ai/orchestrator/web-check');
  const css = { path: 'a/app.css', content: ':root{--bg:#fff}\n@media (min-width: 900px){aside{display:block}}\nbutton{transition:all .2s}' };
  const fonts = '<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet">';
  const no = checkWebFiles([{ path: 'a/index.html', content: page(`${fonts}<main>x</main>`) }, css], { design: 'system', added: new Set(['a/index.html']) });
  assert.match(no.errors.map(e => e.message).join(), /navegação/);
  const yes = checkWebFiles([{ path: 'a/index.html', content: page(`${fonts}<aside><nav>menu</nav></aside><main>x</main>`) }, css], { design: 'system', added: new Set(['a/index.html']) });
  assert.deepStrictEqual(yes.errors, []);
});
