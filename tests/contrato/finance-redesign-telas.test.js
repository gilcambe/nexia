'use strict';
// Redesign do Finance (plano do dono, fases 1 e 2): substitui os contratos do menu lateral antigo.
//  - Barra de baixo com 5 abas: Início, Mês, + Lançar, Patrimônio, Benefícios. Perfil no avatar. Menu lateral não aparece.
//  - Toda tela antiga continua alcançável (nada que funciona sai): por um atalho de Mês, Patrimônio, Benefícios ou Perfil.
//  - Início lê UMA fonte ('painel_resumo'); tem score, Pode gastar hoje, Tenho/Recebi/A pagar, selo estimado,
//    "Como calculamos?", zero em cinza; sem "Primeiros passos", "Como usar" e "Ver mais detalhes".
//  - Cores do design system do plano no :root. "+ Lançar" tem foto, PDF, extrato e digitar; mostra o que mudou.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ler = (f) => fs.readFileSync(path.join(__dirname, '../../prumo', f), 'utf8');
const html = ler('index.html');
const app = ler('app.js');

test('barra de baixo com 5 abas e avatar do Perfil', () => {
  const barra = (html.match(/<nav id="barra"[\s\S]*?<\/nav>/) || [''])[0];
  const ir = [...barra.matchAll(/data-ir="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ir, ['inicio', 'mes', 'lancar', 'patrimonio', 'beneficios']);
  assert.match(html, /id="avatar"/);
  assert.match(html, /nav\.abas,\s*#fundo-menu,\s*#btn-menu\s*\{\s*display:none !important;/, 'menu lateral escondido');
  assert.match(app, /abrirAba\('perfil'\)/);
  assert.match(app, /MB\.abrirLancar/);
});

test('cores do design system no :root', () => {
  const root = (html.match(/:root\s*\{([^}]*)\}/) || ['', ''])[1];
  for (const c of ['#0B1020', '#121B33', '#2F6BFF', '#2ECC71', '#F5A623', '#FF5A5F', '#E8ECF8', '#8B97B8']) assert.ok(root.toUpperCase().includes(c), 'cor ' + c);
});

test('nenhuma tela antiga some: todas alcançáveis pelas abas novas', () => {
  const abas = JSON.parse(app.match(/const ABAS = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
  const atalhos = new Set(['inicio', 'mes', 'patrimonio', 'beneficios', 'perfil']);
  for (const f of ['mes.js', 'patrimonio.js', 'beneficios.js', 'perfil.js']) for (const m of ler(f).matchAll(/\['([a-z]+)', '/g)) atalhos.add(m[1]);
  for (const a of abas) assert.ok(atalhos.has(a), `a tela "${a}" precisa de um atalho`);
  for (const f of ['mes', 'patrimonio', 'beneficios', 'perfil', 'lancar', 'raiox', 'hubs']) assert.ok(ler('sw.js').includes(`'/prumo/${f}.js'`), f + ' no cache do app');
});

test('Início: uma fonte só e as regras do plano', () => {
  const i = ler('inicio.js');
  assert.match(i, /MB\.api\('painel_resumo'\)/);
  assert.doesNotMatch(i, /inicio_resumo|saude_financeira/);
  for (const t of ['Pode gastar hoje', 'Tenho', 'Recebi', 'A pagar', 'Como calculamos?', 'estimado', 'sem dados', 'Pergunte', 'Últimos lançamentos']) assert.ok(i.includes(t), t);
  for (const t of ['Primeiros passos', 'Como usar', 'Ver mais detalhes']) assert.ok(!i.includes(t), 'saiu: ' + t);
  assert.match(i, /ki-zero\{color:#5D6886/, 'zero em cinza');
});

test('+ Lançar: foto, PDF, extrato, digitar e "o que mudou"', () => {
  const l = ler('lancar.js');
  for (const o of ['foto', 'pdf', 'extrato', 'digitar']) assert.match(l, new RegExp(`data-o="${o}"`));
  assert.match(l, /doc_tipo/);
  assert.match(l, /function oQueMudou/);
  assert.match(l, /Pode gastar hoje: /);
});

test('Perfil: cadastros (editar, apagar, desfazer) e Sair', () => {
  const p = ler('perfil.js');
  for (const a of ['cadastros_listar', 'cadastro_apagar', 'desfazer']) assert.ok(p.includes(`'${a}'`), a);
  assert.match(p, /MB\.sair\(\)/);
});
