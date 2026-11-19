'use strict';
// Contrato (épico #4013, fase 10; manual seção 2): relatório anual e exportar.
// netlify/functions/prumo-lib/relatorios.js exporta relatorioAnual(lancs, ano) e paraCSV(linhas).
// lancs = [{ data: 'AAAA-MM-DD', tipo: 'receita'|'despesa', valor, categoria, perfil? }]; perfil 'pj' fica de fora.
// relatorioAnual -> { ano, meses: 12 x { mes, receitas, despesas, saldo }, receitas, despesas, saldo, por_categoria: { cat: total despesas } }.
// paraCSV(linhas: objetos) -> texto com ';', cabeçalho das chaves, número com vírgula decimal, aspas quando há ';' ou aspas.
// Ação 'relatorio_anual' { ano } (ligada em agirExtra, prumo-lib/extra.js). Na tela de ajuda (prumo/ajuda.js) botão para baixar o CSV do ano.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.join(__dirname, '../..');
const ler = (f) => fs.readFileSync(path.join(raiz, f), 'utf8');
const rel = require(path.join(raiz, 'netlify/functions/prumo-lib/relatorios.js'));
const L = [{ data: '2026-01-05', tipo: 'receita', valor: 5000, categoria: 'Salário' }, { data: '2026-01-10', tipo: 'despesa', valor: 1200.5, categoria: 'Moradia' },
  { data: '2026-03-02', tipo: 'despesa', valor: 300, categoria: 'Mercado' }, { data: '2026-03-09', tipo: 'despesa', valor: 99.5, categoria: 'Moradia' },
  { data: '2025-12-31', tipo: 'despesa', valor: 777, categoria: 'X' }, { data: '2026-02-01', tipo: 'receita', valor: 9000, categoria: 'PJ', perfil: 'pj' }];

test('relatório anual: 12 meses, totais e categorias', () => {
  const r = rel.relatorioAnual(L, 2026);
  assert.equal(r.ano, 2026); assert.equal(r.meses.length, 12);
  assert.deepEqual(r.meses[0], { mes: '2026-01', receitas: 5000, despesas: 1200.5, saldo: 3799.5 });
  assert.deepEqual(r.meses[1], { mes: '2026-02', receitas: 0, despesas: 0, saldo: 0 }, 'PJ fora');
  assert.equal(r.receitas, 5000); assert.equal(r.despesas, 1600); assert.equal(r.saldo, 3400);
  assert.deepEqual(r.por_categoria, { Moradia: 1300, Mercado: 300 });
});

test('CSV brasileiro', () => {
  const t = rel.paraCSV([{ mes: '2026-01', nome: 'a;b', valor: 1200.5 }, { mes: '2026-02', nome: 'diz "oi"', valor: 0 }]);
  assert.deepEqual(t.trim().split(/\r?\n/), ['mes;nome;valor', '2026-01;"a;b";1200,5', '2026-02;"diz ""oi""";0']);
});

test('ação relatorio_anual e botão de baixar', () => {
  assert.match(ler('netlify/functions/prumo-lib/relatorios.js'), /'relatorio_anual'/);
  assert.match(ler('netlify/functions/prumo-lib/extra.js'), /require\('\.\/relatorios'\)/, 'ligado em agirExtra (prumo-lib/extra.js)');
  assert.match(ler('prumo/ajuda.js'), /relatorio_anual/);
});
