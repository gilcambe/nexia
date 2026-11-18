'use strict';
// 18/11 (dono): a "Renda (líquido)" do topo vinha do holerite antigo (5.883,37) e não batia com o Salário.
// Regra: renda do mês = recebido + previsão do Salário novo.
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../netlify/functions/prumo.js');

function banco() {
  const dados = new Map();
  const col = (c) => ({ path: c, doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { dados.set(`${c}/${id}`, v); }, delete: async () => { dados.delete(`${c}/${id}`); }, get: async () => { const v = dados.get(`${c}/${id}`); return { exists: !!v, data: () => v }; } }),
    get: async () => ({ docs: [...dados.entries()].filter(([k]) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }), where: () => col(c), orderBy: () => col(c), limit: () => col(c) });
  return { collection: col };
}

test('renda do topo = adiantamento recebido + previsão do fechamento (ignora holerite antigo)', async () => {
  const b = banco(); p.deps.db = () => b; p.deps.agora = () => new Date('2026-11-18T12:00:00Z');
  await p.agir('u1', { acao: 'salario_config', salario_base: 8868.69 });
  await p.agir('u1', { acao: 'pagamento_salvar', tipo: 'adiantamento', mes: '2026-11', data_pagamento: '2026-11-13', bruto: 4434.35, liquido: 4434.35 });
  const prev = (await p.agir('u1', { acao: 'salario_previsao', mes: '2026-11' }))[1];
  const r = (await p.agir('u1', { acao: 'orcamento_resumo', mes: '2026-11' }))[1];
  assert.equal(r.renda_fonte, 'salario');
  assert.equal(r.renda, Math.round((prev.total_recebido + prev.previsao.a_receber) * 100) / 100);
  assert.ok(r.renda > 6000 && r.renda < 7000, `renda ${r.renda}`);
});
