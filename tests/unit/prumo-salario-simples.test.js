'use strict';
// 18/11 (dono): folha fecha dia 11; adiantamento = 50% do base, cai dia 15; salário dia 30 (HE, noturno, descontos);
// sem banco de horas. "Coloque só o valor previsto que receberei no dia 30." Regras abaixo.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const p = require('../../netlify/functions/prumo.js');

function banco() {
  const dados = new Map();
  const col = (c) => ({ path: c, doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { dados.set(`${c}/${id}`, v); }, delete: async () => { dados.delete(`${c}/${id}`); }, get: async () => { const v = dados.get(`${c}/${id}`); return { exists: !!v, data: () => v }; } }),
    get: async () => ({ docs: [...dados.entries()].filter(([k]) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }), where: () => col(c), orderBy: () => col(c), limit: () => col(c) });
  return { collection: col };
}
const PONTO = { acao: 'ponto_salvar', mes: '2026-11', he75: '03:34', he100: '36:39', noturnas: '210:05', sobreaviso: '72:00', faltas: '0:13' };
async function preparar(comAdiantamento) {
  const b = banco(); p.deps.db = () => b; p.deps.agora = () => new Date('2026-11-18T12:00:00Z');
  await p.agir('u', { acao: 'salario_config', salario_base: 8868.69, perfil: { noturno_pct: 30, fixos: 179, nao_tributavel: 100, prev_pct: 10, descontos_fixos: 77 } });
  await p.agir('u', PONTO);
  if (comAdiantamento) await p.agir('u', { acao: 'pagamento_salvar', tipo: 'adiantamento', mes: '2026-11', data_pagamento: '2026-11-13', bruto: 4434.35, liquido: 4434.35 });
  return (await p.agir('u', { acao: 'salario_previsao', mes: '2026-11' }))[1];
}

test('sem lançar, o adiantamento de 50% (dia 15) já é descontado do dia 30', async () => {
  const r = await preparar(false);
  assert.deepEqual(r.previsao.adiantamento, { valor: 4434.35, data: '2026-11-15', status: 'caiu', automatico: true });
  assert.equal(r.previsao.data_salario, '2026-11-30');
  assert.equal(r.previsao.a_receber, Math.round((r.previsao.liquido - 4434.35) * 100) / 100);
});

test('lançado ou automático: o dia 30 é o mesmo; renda do mês = líquido inteiro', async () => {
  const auto = await preparar(false);
  const lanc = await preparar(true);
  assert.equal(lanc.previsao.adiantamento.automatico, false);
  assert.equal(lanc.previsao.a_receber, auto.previsao.a_receber);
  const o = (await p.agir('u', { acao: 'orcamento_resumo', mes: '2026-11' }))[1];
  assert.equal(o.renda, lanc.previsao.liquido);
});

test('tela mostra só Dia 15 e Dia 30; o cálculo fica escondido', () => {
  const window = { MB: { ui: { brl: (v) => `R$ ${v}`, esc: (s) => String(s == null ? '' : s) } } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../prumo/salario.js'), 'utf8'), { window, console });
  const h = window.MB.salario.cartao({ mes: '2026-11', recebidos: [], total_recebido: 0, previsao: { a_receber: 7839.29, liquido: 12273.64, data_salario: '2026-11-30', adiantamento: { valor: 4434.35, data: '2026-11-15', status: 'caiu' }, linhas: [{ nome: 'INSS', valor: -988.09 }], aviso: '' } });
  assert.match(h, /Dia 15 · Adiantamento/);
  assert.match(h, /Dia 30 · Você vai receber<\/div><div class="grande">R\$\s7\.839,29/);
  assert.match(h, /<details[^>]*><summary[^>]*>Ver cálculo<\/summary>[\s\S]*INSS/);
  assert.doesNotMatch(h, /Previsão do fechamento/);
});

test('Início ("quanto ainda cai") usa a mesma previsão do Salário, com a folha de ponto (não a coleção das milhas)', async () => {
  const r = await preparar(false);
  const fi = (await p.agir('u', { acao: 'inicio_resumo' }))[1].fluxo_inicio;
  assert.equal(fi.previsao_salario, r.previsao.a_receber);
  const src = fs.readFileSync(path.join(__dirname, '../../netlify/functions/prumo-lib/fluxo.js'), 'utf8');
  assert.match(src, /collection\('folhas_ponto'\)/);
  assert.doesNotMatch(src, /collection\('pontos'\)/);
});
