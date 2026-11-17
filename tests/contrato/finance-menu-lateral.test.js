'use strict';
// Contrato: Kernex Finance com MENU LATERAL (dono 17/11: "esses ícones embaixo da tela com barra de rolagem ficam
// horríveis... faça um menu lateral"). Hoje são 21 abas numa barra presa embaixo que rola de lado; a "Carteira" (onde
// fica "Limpar e refazer a carteira") é a 14ª e ninguém acha.
// Pronto quando:
//  - no topo há um botão de menu (#btn-menu, ícone ☰ em <svg>, aria-label="Menu", aria-expanded);
//  - no celular, nav#abas é uma GAVETA à esquerda: escondida (transform: translateX(-100%)) e aberta com a classe
//    .aberto (translateX(0)); por trás, um fundo escuro #fundo-menu que fecha ao tocar; nada de barra embaixo nem de
//    rolagem de lado;
//  - as abas ficam em GRUPOS com título (.titulo-grupo): "Visão geral", "Dia a dia", "Investimentos", "Planos",
//    "Documentos", "Ajustes"; cada botão com ícone em <svg> (sem emoji) e o nome;
//  - abrir uma aba fecha a gaveta; Esc fecha; o topo mostra o nome da aba aberta (#titulo-aba);
//  - no PC (≥ 1024px) o menu fica sempre aberto à esquerda e o #btn-menu some.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(raiz, 'prumo/index.html'), 'utf8');
const app = fs.readFileSync(path.join(raiz, 'prumo/app.js'), 'utf8');
const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
const semMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^}]*\})*[^{}]*\}/g, '');
const pc = [...css.matchAll(/@media[^{]*min-width\s*:\s*(\d+)px[^{]*\{((?:[^{}]*\{[^}]*\})*)[^{}]*\}/g)].filter((m) => Number(m[1]) >= 1000 && Number(m[1]) <= 1280).map((m) => m[2]).join('\n');
const decl = (bloco, re) => [...bloco.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter((r) => r[1].split(',').some((s) => re.test(s.trim()))).map((r) => r[2]).join(';');
const nav = (/<nav id="abas"[\s\S]*?<\/nav>/.exec(html) || [''])[0];
const ABAS = ['inicio', 'assistente', 'consultor', 'contas', 'cartoes', 'gastos', 'compras', 'orcamento', 'dividas', 'economizar', 'investimentos', 'carteira', 'pontos', 'metas', 'objetivos', 'familia', 'documentos', 'impostos', 'conexoes', 'alertas', 'ajuda'];

test('botão de menu no topo: #btn-menu com ícone ☰ em <svg>, aria-label="Menu" e aria-expanded="false"', () => {
  const b = (/<button[^>]*id="btn-menu"[^>]*>[\s\S]*?<\/button>/.exec(html) || [''])[0];
  assert.ok(b, 'crie <button id="btn-menu"> dentro do <header>');
  assert.match(b, /aria-label="Menu"/);
  assert.match(b, /aria-expanded="false"/);
  assert.match(b, /<svg[\s\S]*<\/svg>/, 'ícone ☰ desenhado em <svg> (3 linhas)');
  assert.match(html, /<header>[\s\S]*id="btn-menu"[\s\S]*<\/header>/, '#btn-menu fica no <header>');
  assert.match(html, /<header>[\s\S]*id="titulo-aba"[\s\S]*<\/header>/, 'o topo mostra a aba aberta em #titulo-aba');
});

test('as 21 abas continuam, em grupos com título e com ícone em <svg> (sem emoji)', () => {
  for (const a of ABAS) assert.match(nav, new RegExp(`data-aba="${a}"`), `a aba ${a} continua no menu`);
  for (const g of ['Visão geral', 'Dia a dia', 'Investimentos', 'Planos', 'Documentos', 'Ajustes']) {
    assert.match(nav, new RegExp(`class="titulo-grupo"[^>]*>\\s*${g}\\s*<`), `grupo "${g}" com <p class="titulo-grupo">`);
  }
  const botoes = [...nav.matchAll(/<button[^>]*data-aba="(\w+)"[^>]*>([\s\S]*?)<\/button>/g)];
  assert.ok(botoes.length >= ABAS.length, "nenhuma aba some (abas novas podem entrar)");
  for (const [, a, dentro] of botoes) {
    assert.match(dentro, /<svg[\s\S]*<\/svg>/, `aba ${a}: ícone em <svg>`);
    assert.doesNotMatch(dentro, /\p{Extended_Pictographic}/u, `aba ${a}: sem emoji (ícone em <svg>)`);
  }
});

test('no celular o menu é uma gaveta à esquerda (escondida; .aberto mostra), com fundo #fundo-menu; nada de barra embaixo', () => {
  const n = decl(semMedia, /^nav\.abas$|^#abas$/);
  assert.match(n, /position\s*:\s*fixed/);
  assert.match(n, /left\s*:\s*0/);
  assert.match(n, /top\s*:\s*0/);
  assert.match(n, /transform\s*:\s*translateX\(-100%\)/, 'gaveta escondida: transform: translateX(-100%)');
  assert.match(n, /flex-direction\s*:\s*column/);
  assert.doesNotMatch(n, /overflow-x\s*:\s*auto/, 'sem rolagem de lado');
  assert.doesNotMatch(n, /(^|;)\s*bottom\s*:\s*calc/, 'não fica mais preso embaixo');
  assert.match(decl(semMedia, /^nav\.abas\.aberto$|^#abas\.aberto$/), /transform\s*:\s*(translateX\(0\)|none)/, '.aberto mostra a gaveta');
  assert.match(html, /<div id="fundo-menu"[^>]*hidden/, 'fundo escuro <div id="fundo-menu" hidden>');
});

test('app.js: ☰ abre/fecha (classe aberto + aria-expanded + fundo); tocar no fundo, abrir aba ou Esc fecha; título da aba', () => {
  assert.match(app, /btn-menu/);
  assert.match(app, /classList\.(toggle|add)\(\s*['"]aberto['"]/);
  assert.match(app, /classList\.remove\(\s*['"]aberto['"]/);
  assert.match(app, /aria-expanded/);
  assert.match(app, /fundo-menu/);
  assert.match(app, /['"]Escape['"]/, 'Esc fecha o menu');
  assert.match(app, /titulo-aba/, 'abrirAba escreve o nome da aba em #titulo-aba');
  const abrir = (/async function abrirAba[\s\S]*?\n  \}/.exec(app) || [''])[0];
  assert.match(abrir, /fecharMenu\(\)|classList\.remove\(\s*['"]aberto['"]/, 'abrir uma aba fecha o menu');
});

test('no PC (≥ 1024px) o menu fica sempre aberto e o ☰ some', () => {
  assert.match(decl(pc, /^nav\.abas$|^#abas$/), /transform\s*:\s*(none|translateX\(0\))/, 'no PC: transform none');
  assert.match(decl(pc, /^#btn-menu$/), /display\s*:\s*none/, 'no PC: #btn-menu { display: none }');
});

test('ícones do menu bem formados e na cor do texto (não pretos sobre o fundo escuro)', () => {
  // 1ª entrega (#3877): os <svg> não tinham stroke/fill e saíram PRETOS (padrão do navegador) no menu escuro, quase
  // invisíveis; e vinham malformados ("<path d=...>" sem fechar, com o resto do desenho "dentro" do path).
  const svgs = [...nav.matchAll(/<svg[\s\S]*?<\/svg>/g)].map((m) => m[0]);
  assert.ok(svgs.length >= ABAS.length);
  const cssCor = decl(semMedia, /^nav\.abas( button)? svg$|^#abas( button)? svg$/);
  const corNoCss = /stroke\s*:\s*currentColor/.test(cssCor) && /fill\s*:\s*none/.test(cssCor);
  for (const s of svgs) {
    for (const t of s.matchAll(/<(path|circle|rect|line|polyline|polygon|ellipse)\b[^>]*>/g)) {
      assert.match(t[0], /\/>$/, `feche cada forma do ícone com "/>": ${t[0].slice(0, 60)}`);
    }
    if (!corNoCss) {
      assert.match(s, /stroke="currentColor"/, 'ícone de linha: stroke="currentColor" (ou no CSS: nav.abas svg { stroke: currentColor; fill: none })');
      assert.match(s, /fill="none"/, 'ícone de linha: fill="none" (senão o navegador pinta de preto)');
    }
  }
});
