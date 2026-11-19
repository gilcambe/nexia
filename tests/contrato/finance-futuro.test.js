'use strict';
// Redesign fase 5: 'patrimonio_resumo' soma contas + investimentos + FGTS - dívidas, mostra a composição,
// a reserva, a independência (investido ÷ gasto mensal × 12 × 25) e as dívidas por juros (maior primeiro).
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../../netlify/functions/prumo.js');
const { independencia } = require('../../netlify/functions/prumo-lib/futuro');
function banco() { const d = new Map(); const col = (c) => ({ doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { d.set(`${c}/${id}`, v); }, get: async () => { const v = d.get(`${c}/${id}`); return { exists: !!v, data: () => v }; }, delete: async () => { d.delete(`${c}/${id}`); } }), get: async () => ({ docs: [...d.entries()].filter(([k]) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }), where() { return this; }, orderBy() { return this; }, limit() { return this; } }); return { collection: col }; }

test('independência: regra dos 25 anos de gasto', () => {
  assert.deepEqual(independencia(150000, 5000), { investido: 150000, alvo: 1500000, pct: 10 });
  assert.equal(independencia(1000, 0), null);
});

test('patrimonio_resumo: total, composição e dívidas por juros', async () => {
  const b = banco(); P.deps.db = () => b; P.deps.agora = () => new Date('2026-11-19T12:00:00Z');
  const A = (x) => P.agir('u', x);
  await A({ acao: 'conta_salvar', nome: 'Corrente', tipo: 'corrente', saldo: 2000 });
  await A({ acao: 'carteira_salvar', nome: 'CDB', tipo: 'renda_fixa', valor: 10000 });
  await A({ acao: 'carteira_salvar', nome: 'PETR4', tipo: 'acoes', valor: 3000 });
  await A({ acao: 'fgts_salvar', saldo: 5000 });
  await A({ acao: 'divida_salvar', credor: 'Banco A', tipo: 'emprestimo', saldo: 4000, juros_mes: 2, parcela: 300, dia_vencimento: 10 });
  await A({ acao: 'divida_salvar', credor: 'Cartão B', tipo: 'cartao', saldo: 1000, juros_mes: 12, parcela: 200, dia_vencimento: 15 });
  const [st, r] = await A({ acao: 'patrimonio_resumo' });
  assert.equal(st, 200);
  assert.equal(r.bruto, 20000);
  assert.equal(r.dividas_total, 5000);
  assert.equal(r.total, 15000);
  assert.deepEqual(r.composicao.map((x) => x.id), ['renda_fixa', 'fgts', 'acoes_fiis', 'conta']);
  assert.deepEqual(r.dividas.map((x) => x.credor), ['Cartão B', 'Banco A']);
  assert.equal(r.dividas[0].custo_mes, 120);
  assert.match(r.aviso, /Não é recomendação/);
});
