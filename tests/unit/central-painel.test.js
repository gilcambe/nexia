'use strict';
// Central Kernex no visual novo: menu lateral, cabeçalho, Início com dados reais e logos que existem de verdade.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..', '..');
const ler = (f) => fs.readFileSync(path.join(raiz, f), 'utf8');
const { PRODUTOS } = require('../../central/produtos');

test('CENTRAL-PAINEL: moldura com menu lateral no PC, cabeçalho e barra no celular', () => {
  const s = ler('src/pages/central/page.tsx');
  for (const t of ['lg:pl-64', 'Acesso rápido', 'nexia-c8710', 'central-busca', 'lg:hidden', 'Sistema online']) assert.ok(s.includes(t), t);
  assert.ok(!s.includes('max-w-2xl'));
});

test('CENTRAL-PAINEL: Início com as seções do exemplo e sem número inventado', () => {
  const s = ler('src/pages/central/Painel.tsx');
  for (const t of ['Olá, Gil', 'Ecossistema', 'Tenants', 'Tarefas recentes', 'Topologia do ecossistema', 'Uso de IA', 'Máquinas locais', 'Status dos serviços', 'Ações rápidas', 'Alertas e notificações', 'sem dado ainda']) assert.ok(s.includes(t), t);
  assert.doesNotMatch(s, />\s*\d+(\.\d+)?\s*[MK%]?\s*</);
  assert.doesNotMatch(s, /2\.4M|US\$/);
});

test('CENTRAL-PAINEL: todo logo citado existe em public/', () => {
  for (const p of PRODUTOS) if (p.logo) assert.ok(fs.existsSync(path.join(raiz, 'public', p.logo)), p.id);
  const fontes = ler('src/pages/central/Painel.tsx') + ler('src/pages/central/page.tsx') + ler('src/pages/central/Logo.tsx');
  for (const m of fontes.matchAll(/\/central\/logos\/([\w.-]+\.(?:svg|png))/g)) assert.ok(fs.existsSync(path.join(raiz, 'public/central/logos', m[1])), m[1]);
  assert.ok(ler('src/pages/central/Logo.tsx').includes('Ícone provisório'));
});
