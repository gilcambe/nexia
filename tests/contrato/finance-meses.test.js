'use strict';
// Dono 20/11: ver o que vai sair nos próximos meses (contas futuras, faturas, parcelas até quitar, contas fixas).
const test = require('node:test');
const assert = require('node:assert/strict');
const { proximosMeses } = require('../../netlify/functions/prumo-lib/meses');

test('próximos meses: parcela some quando a dívida acaba; fixa todo mês; fatura no mês do vencimento', () => {
  const r = proximosMeses({ hoje: '2026-11-20', meses: 3,
    futuros: [{ data: '2027-01-15', descricao: 'IPVA', valor: 800 }],
    faturas: [{ vencimento: '2026-12-08', valor: 1500.5 }],
    dividas: [{ credor: 'Banco', saldo: 1000, parcela: 400, dia_vencimento: 10 }],
    fixas: [{ nome: 'Aluguel', valor: 1200, dia: 5 }] });
  assert.deepEqual(r.map((m) => m.mes), ['2026-12', '2027-01', '2027-02']);
  assert.deepEqual(r[0].itens.map((x) => [x.data, x.nome, x.valor]), [['2026-12-05', 'Aluguel', 1200], ['2026-12-08', 'Fatura do cartão', 1500.5], ['2026-12-10', 'Parcela Banco', 400]]);
  assert.deepEqual(r[1].itens.map((x) => x.nome), ['Aluguel', 'Parcela Banco', 'IPVA']);
  assert.equal(r[1].itens.find((x) => x.nome === 'Parcela Banco').valor, 200, 'última parcela é o que sobrou');
  assert.deepEqual(r[2].itens.map((x) => x.nome), ['Aluguel']);
  assert.equal(r[0].total, 3100.5);
});
