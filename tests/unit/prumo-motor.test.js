'use strict';
// Kernex Finance, fase 1: o motor financeiro determinístico (a IA nunca faz conta).
const test = require('node:test');
const assert = require('node:assert/strict');
const { conciliar, patrimonio, custoMilheiro } = require('../../netlify/functions/prumo-lib/motor');

test('KF1. fatura + extrato da mesma compra contam uma vez; fatura paga e TED própria não são receita nem despesa', () => {
  const r = conciliar([
    { data: '2026-10-02', valor: 100, estabelecimento: 'Mercado Zé', tipo: 'despesa', documento: 'fatura' },
    { data: '2026-10-02', valor: 100, estabelecimento: 'MERCADO ZE', tipo: 'despesa', documento: 'extrato' },
    { data: '2026-10-05', valor: 2000, descricao: 'Pagamento fatura', tipo: 'pagamento_fatura' },
    { data: '2026-10-06', valor: 500, descricao: 'TED própria', tipo: 'transferencia_propria' },
    { data: '2026-10-07', valor: 3000, descricao: 'Salário', tipo: 'receita' },
  ]);
  assert.equal(r.despesas, 100);
  assert.equal(r.receitas, 3000);
  assert.equal(r.saldo, 2900);
  assert.equal(r.conferir.length, 1);
  assert.match(r.conferir[0].motivo, /duplicidade/);
});

test('KF2. leitura com pouca confiança ou dados incompletos vai para conferir, nunca para o total', () => {
  const r = conciliar([
    { data: '2026-10-08', valor: 50, descricao: 'borrado', tipo: 'despesa', confianca: 0.4 },
    { data: 'ontem', valor: 10, descricao: 'sem data', tipo: 'despesa' },
    { data: '2026-10-09', valor: 'abc', descricao: 'sem valor', tipo: 'despesa' },
  ]);
  assert.equal(r.despesas, 0);
  assert.equal(r.conferir.length, 3);
});

test('KF3. patrimônio desconta dívidas e soma em centavos (sem erro de ponto flutuante)', () => {
  assert.equal(patrimonio({ contas: [{ valor: 0.1 }, { valor: 0.2 }], dividas: [{ valor: 0.05 }] }).liquido, 0.25);
  const p = patrimonio({ contas: [{ valor: 1000 }], investimentos: [{ valor: 5000 }], dividas: [{ valor: 2500 }] });
  assert.deepEqual(p, { ativos: 6000, passivos: 2500, liquido: 3500 });
});

test('KF4. custo do milheiro inclui anuidade; sem milhas devolve null', () => {
  assert.equal(custoMilheiro({ preco: 300, milhas: 10000 }), 30);
  assert.equal(custoMilheiro({ preco: 300, milhas: 10000, anuidade: 100 }), 40);
  assert.equal(custoMilheiro({ preco: 300, milhas: 0 }), null);
});
