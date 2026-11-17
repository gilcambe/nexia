'use strict';
// Contrato: Kernex Finance — BASE VISUAL de todas as telas (dono 17/11: "não adianta mudar os ícones se o layout de
// todas as páginas está ruim... seja criativo"). Vistos no celular (375 px):
//  - o ☰ aparece como um quadrado vazio (o <svg> não tem tamanho);
//  - "Kernex Finance" quebra em 2 linhas e o topo fica apertado com "Instalar app" grande;
//  - Receita / Gasto / Economia: o 3º cartão cai para outra linha (flex-wrap) e os cartões ficam com larguras diferentes;
//  - a classe .verde pinta de AZUL (usa --verde2, que é azul); ganho tem que ser verde;
//  - restos do tema antigo verde-escuro (#1d3127 no botão secundário, #0e1a14 em campos e barras) brigando com o azul;
//  - o rodapé é position:fixed e cobre o fim de cada tela.
// Pronto quando (em prumo/ui.js, no CSS de st.textContent, e em prumo/index.html):
//  1) #btn-menu svg com width e height de 24px; #btn-menu com 40px de largura e altura;
//  2) header h1 numa linha só (white-space:nowrap; text-overflow:ellipsis; overflow:hidden); no celular
//     (@media (max-width: 599px)) o h1 some (display:none) e o #titulo-aba vira o título (font-weight 600+ e flex:1);
//  3) botão Instalar: o texto fica num <span class="rotulo"> e some no celular (só o 📲);
//  ATENÇÃO: o CSS de ui.js entra DEPOIS do index.html e vence; por isso use seletores mais fortes: .linha.kf-tres e
//  .card.kf-hero (só .kf-tres perde para .linha{display:flex}; só .kf-hero perde para .card{background}).
//  4) .linha.kf-tres vira grade: display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); e os .card dentro dela sem
//     margem; .verde usa var(--ganho) e .verm usa var(--perda);
//  5) números alinhados: .grande, .item .v e .n com font-variant-numeric: tabular-nums;
//  6) nenhum #1d3127 nem #0e1a14 no CSS (use tons do azul do tema, ex.: #16244a, #0b1530);
//  7) footer sem position:fixed (fica no fim da página, sem cobrir nada);
//  8) .kf-hero (cartão principal do Início) com fundo em degradê (linear-gradient) do azul do tema.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(raiz, 'prumo/index.html'), 'utf8');
const ui = fs.readFileSync(path.join(raiz, 'prumo/ui.js'), 'utf8');
const cssHtml = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
const cssUi = ((/st\.textContent\s*=\s*`([\s\S]*?)`/.exec(ui)) || [])[1] || '';
const css = cssHtml + '\n' + cssUi;
const semMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^}]*\})*[^{}]*\}/g, '');
const celular = [...css.matchAll(/@media[^{]*max-width\s*:\s*(\d+)px[^{]*\{((?:[^{}]*\{[^}]*\})*)[^{}]*\}/g)].filter((m) => Number(m[1]) >= 480 && Number(m[1]) <= 767).map((m) => m[2]).join('\n');
const decl = (bloco, re) => [...bloco.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter((r) => r[1].split(',').some((s) => re.test(s.trim()))).map((r) => r[2]).join(';');

test('☰ visível: svg 24px e botão de 40px', () => {
  const s = decl(semMedia, /^#btn-menu svg$/);
  assert.match(s, /width\s*:\s*24px/); assert.match(s, /height\s*:\s*24px/);
  const b = decl(semMedia, /^#btn-menu$/);
  assert.match(b, /width\s*:\s*40px/); assert.match(b, /height\s*:\s*40px/);
});

test('topo: título numa linha; no celular o nome da aba vira o título; Instalar só com ícone', () => {
  const h = decl(semMedia, /^header h1$/);
  assert.match(h, /white-space\s*:\s*nowrap/); assert.match(h, /text-overflow\s*:\s*ellipsis/); assert.match(h, /overflow\s*:\s*hidden/);
  assert.ok(celular, 'crie um @media (max-width: 599px) { ... }');
  assert.match(decl(celular, /^header h1$/), /display\s*:\s*none/);
  const t = decl(celular, /^#titulo-aba$/);
  assert.match(t, /font-weight\s*:\s*(6|7|8)00|font-weight\s*:\s*bold/); assert.match(t, /flex\s*:\s*1/);
  assert.match(html, /<button[^>]*id="instalar"[^>]*>[^<]*<span class="rotulo">[^<]*Instalar app<\/span><\/button>/);
  assert.match(decl(celular, /^#instalar \.rotulo$|^\.instalar \.rotulo$|^header \.rotulo$/), /display\s*:\s*none/);
});

test('cartões Receita/Gasto/Economia em grade de 3 iguais; .verde é verde e .verm é vermelho', () => {
  const g = decl(semMedia, /^\.linha\.kf-tres$/);
  assert.match(g, /display\s*:\s*grid/);
  assert.match(g, /grid-template-columns\s*:\s*repeat\(\s*3\s*,\s*minmax\(\s*0\s*,\s*1fr\s*\)\s*\)/);
  assert.match(decl(semMedia, /^\.linha\.kf-tres\s*>\s*\.card$|^\.linha\.kf-tres \.card$/), /margin\s*:\s*0/);
  assert.match(decl(semMedia, /^\.verde$/), /color\s*:\s*var\(--ganho\)/);
  assert.match(decl(semMedia, /^\.verm$/), /color\s*:\s*var\(--perda\)/);
  const root = (/:root\s*\{([^}]*)\}/.exec(cssHtml) || [])[1] || '';
  assert.match(root, /--ganho\s*:/); assert.match(root, /--perda\s*:/);
});

test('números alinhados (tabular-nums)', () => {
  for (const re of [/^\.grande$/, /^\.item \.v$/, /^\.n$|^\.item \.n$/]) assert.match(decl(semMedia, re), /font-variant-numeric\s*:\s*tabular-nums/, `tabular-nums em ${re}`);
});

test('sem restos do tema verde-escuro; rodapé não cobre a tela; cartão principal com degradê', () => {
  assert.doesNotMatch(css, /#1d3127|#0e1a14/i);
  assert.doesNotMatch(decl(semMedia, /^footer$/), /position\s*:\s*fixed/);
  assert.match(decl(semMedia, /^\.card\.kf-hero$/), /background(-image)?\s*:\s*linear-gradient\(/);
});
