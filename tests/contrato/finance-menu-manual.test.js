'use strict';
// Contrato (dono 18/11: "o Finance é muito confuso"): o menu segue as telas do manual "CFO Pessoal Inteligente"
// (seção 2: navegação prioriza tarefas frequentes, sem excesso de telas). Pronto quando prumo/index.html tem os grupos
// abaixo, NESTA ordem, cada aba existente dentro do grupo certo, e NENHUMA aba some (nada que funciona é retirado).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../../prumo/index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../../prumo/app.js'), 'utf8');

const GRUPOS = [
  ['Visão geral', ['inicio']],
  ['Salário e folha', ['orcamento', 'carreira']],
  ['Contas e transações', ['contas', 'gastos', 'compras', 'documentos', 'conexoes']],
  ['Cartões', ['cartoes']],
  ['Orçamento e metas', ['metas', 'objetivos']],
  ['Fluxo de caixa', ['fluxo']],
  ['Dívidas', ['dividas']],
  ['Patrimônio', ['investimentos', 'carteira', 'mercado', 'robos', 'pontos', 'viagens', 'aposentadoria']],
  ['Economia', ['economizar', 'impostos']],
  ['Assistente IA', ['assistente', 'consultor']],
  ['Configurações', ['familia', 'alertas', 'ajuda']],
];

// Lê o menu: cada <button class="titulo-grupo">Nome</button> seguido das abas (data-aba) até o próximo grupo.
function menu() {
  const partes = html.split(/<button[^>]*class="titulo-grupo"[^>]*>/).slice(1);
  return partes.map((p) => ({ nome: p.slice(0, p.indexOf('</button>')).trim(), abas: [...p.matchAll(/data-aba="([a-z_]+)"/g)].map((m) => m[1]) }));
}

test('o menu tem os grupos do manual, nesta ordem', () => {
  assert.deepEqual(menu().map((g) => g.nome), GRUPOS.map((g) => g[0]));
});

test('cada aba está no grupo certo', () => {
  const m = menu();
  for (const [nome, abas] of GRUPOS) {
    const g = m.find((x) => x.nome === nome);
    assert.ok(g, 'falta o grupo ' + nome);
    for (const a of abas) assert.ok(g.abas.includes(a), `a aba "${a}" deve ficar em "${nome}"`);
  }
});

test('nenhuma aba some: toda aba do app continua no menu, uma vez só', () => {
  const lista = (app.match(/ABAS = \[([^\]]*)\]/) || [])[1] || '';
  const abasApp = [...lista.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  assert.ok(abasApp.length >= 20, 'não achei a lista ABAS em prumo/app.js');
  const noMenu = menu().flatMap((g) => g.abas);
  for (const a of abasApp) assert.equal(noMenu.filter((x) => x === a).length, 1, `a aba "${a}" deve aparecer uma vez no menu`);
});
