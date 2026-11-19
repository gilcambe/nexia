'use strict';
// Contrato: Kernex Finance — gaveta do menu que FECHA e grupos que ABREM AO TOCAR (dono 17/11, print do celular:
// "como saio da barra lateral na frente dos dados? ... separe os tópicos e só abre as opções se eu clicar no tópico").
// Hoje: o #fundo-menu não tem CSS (tamanho zero), então tocar fora não fecha; o ☰ fica escondido atrás da gaveta; a
// gaveta tem z-index 5 (igual ao topo); a lista mostra as 21 abas de uma vez; sobra padding-bottom:120px da barra antiga.
// Pronto quando:
//  - #fundo-menu cobre a tela (position:fixed; inset:0 ou top/right/bottom/left 0), escurece (background rgba) e fica
//    ENTRE a página e a gaveta (z-index do fundo > 5 e < z-index da gaveta);
//  - dentro da gaveta, no topo, um botão <button id="fechar-menu" aria-label="Fechar menu"> com um X em <svg>;
//  - cada título de grupo vira <button type="button" class="titulo-grupo" aria-expanded="false" data-grupo="ID">Nome</button>
//    seguido de <div class="grupo" id="grupo-ID" hidden> com os botões das abas daquele grupo (IDs: visao, dia, invest,
//    planos, docs, ajustes);
//  - app.js: tocar no título abre/fecha SÓ aquele grupo (hidden + aria-expanded); abrir uma aba deixa o grupo dela aberto;
//    #fechar-menu e tocar no fundo fecham a gaveta;
//  - o body perde o padding-bottom de 120px (não há mais barra embaixo).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(raiz, 'prumo/index.html'), 'utf8');
const app = fs.readFileSync(path.join(raiz, 'prumo/app.js'), 'utf8');
const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
const semMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^}]*\})*[^{}]*\}/g, '');
const decl = (re) => [...semMedia.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter((r) => r[1].split(',').some((s) => re.test(s.trim()))).map((r) => r[2]).join(';');
const zi = (d) => { const m = /z-index\s*:\s*(\d+)/.exec(d); return m ? Number(m[1]) : null; };
const nav = (/<nav id="abas"[\s\S]*?<\/nav>/.exec(html) || [''])[0];
// 18/11: grupos do manual CFO Pessoal (tests/contrato/finance-menu-manual.test.js, épico #4013).
const GRUPOS = { visao: ['inicio'], salario: ['orcamento', 'carreira'], contas: ['contas', 'gastos', 'compras', 'documentos', 'conexoes'], cartoes: ['cartoes'], orcamento: ['metas', 'objetivos'], fluxo: ['fluxo'], dividas: ['dividas'], patrimonio: ['investimentos', 'carteira', 'mercado', 'robos', 'pontos', 'viagens', 'aposentadoria'], economia: ['economizar', 'impostos'], assistente: ['assistente', 'consultor'], config: ['familia', 'alertas', 'ajuda'] };

test('#fundo-menu cobre a tela, escurece e fica entre a página e a gaveta', () => {
  const f = decl(/^#fundo-menu$/);
  assert.match(f, /position\s*:\s*fixed/, '#fundo-menu { position: fixed }');
  assert.ok(/inset\s*:\s*0/.test(f) || ['top', 'right', 'bottom', 'left'].every((k) => new RegExp(`(^|;)\\s*${k}\\s*:\\s*0`).test(f)), '#fundo-menu cobre a tela (inset: 0)');
  assert.match(f, /background(-color)?\s*:\s*rgba\(/, '#fundo-menu escurece (background: rgba(0,0,0,.5))');
  const zf = zi(f); const zn = zi(decl(/^nav\.abas$|^#abas$/));
  assert.ok(zf !== null && zn !== null, 'z-index no #fundo-menu e no nav.abas');
  assert.ok(zf > 5 && zf < zn, `z-index: topo 5 < fundo (${zf}) < gaveta (${zn})`);
  if (/display\s*:/.test(f)) assert.match(decl(/^#fundo-menu\[hidden\]$/), /display\s*:\s*none/, 'se der display ao #fundo-menu, ponha #fundo-menu[hidden] { display: none }');
  // 2ª rodada (#3885): o fundo tinha "display:none" fixo e nunca aparecia (tocar fora não fechava). Sem hidden ele APARECE.
  assert.doesNotMatch(f, /display\s*:\s*none/, '#fundo-menu sem display:none (quem esconde é o atributo hidden)');
});

test('botão X para fechar dentro da gaveta', () => {
  const b = (/<button[^>]*id="fechar-menu"[^>]*>[\s\S]*?<\/button>/.exec(nav) || [''])[0];
  assert.ok(b, '<button id="fechar-menu"> dentro de <nav id="abas">');
  assert.match(b, /aria-label="Fechar menu"/);
  assert.match(b, /<svg[\s\S]*<\/svg>/, 'X desenhado em <svg>');
  assert.ok(nav.indexOf('id="fechar-menu"') < nav.indexOf('data-aba='), 'o X fica no topo da gaveta, antes das abas');
  assert.match(app, /fechar-menu/);
});

test('grupos viram botões que abrem e fecham; cada grupo guarda só as suas abas', () => {
  for (const [g, abas] of Object.entries(GRUPOS)) {
    const t = new RegExp(`<button[^>]*data-grupo="${g}"[^>]*>`).exec(nav);
    assert.ok(t, `título do grupo ${g}: <button ... data-grupo="${g}">`);
    assert.match(t[0], /class="titulo-grupo"/, `título do grupo ${g} é <button class="titulo-grupo">`);
    assert.match(t[0], /aria-expanded="(true|false)"/, `grupo ${g}: aria-expanded`);
    const div = (new RegExp(`<div[^>]*id="grupo-${g}"[^>]*>([\\s\\S]*?)</div>`).exec(nav) || [])[0];
    assert.ok(div, `<div class="grupo" id="grupo-${g}">`);
    for (const a of abas) assert.match(div, new RegExp(`data-aba="${a}"`), `aba ${a} dentro do grupo ${g}`);
  }
  const fechados = [...nav.matchAll(/<div[^>]*class="grupo"[^>]*>/g)].filter((m) => /\bhidden\b/.test(m[0])).length;
  assert.ok(fechados >= 5, 'começam fechados (hidden), só o grupo da aba aberta fica aberto');
});

test('app.js: tocar no título abre/fecha o grupo; abrir aba abre o grupo dela; X e fundo fecham a gaveta', () => {
  assert.match(app, /titulo-grupo/);
  assert.match(app, /\.hidden\s*=|toggleAttribute\(\s*['"]hidden['"]/, 'mostra/esconde o grupo com hidden');
  assert.match(app, /aria-expanded/);
  assert.match(app, /closest\(\s*['"]\.grupo['"]\s*\)|grupo-/, 'ao abrir uma aba, acha o grupo dela e abre');
  assert.match(app, /fechar-menu['"]?\)?[\s\S]{0,80}fecharMenu|fecharMenu[\s\S]{0,80}fechar-menu/, '#fechar-menu chama fecharMenu');
});

test('sem sobra da barra antiga: body sem padding-bottom de 120px', () => {
  assert.doesNotMatch(decl(/^body$/), /padding-bottom\s*:\s*calc\(\s*120px/);
});
