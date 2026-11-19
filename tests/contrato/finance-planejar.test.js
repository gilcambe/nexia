'use strict';
// Contrato (melhorias 6, 10, 14, 17): 'planejar_mes' lê do BANCO (despesas realizadas em lancamentos, saldo das contas,
// previsto do mês) e devolve calendário, reserva e fim do mês; as ações calendario_mes/reserva_status/fim_mes_previsao também.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../../netlify/functions/prumo.js');
function banco() { const d = new Map(); const col = (c) => ({ doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { d.set(`${c}/${id}`, v); }, get: async () => { const v = d.get(`${c}/${id}`); return { exists: !!v, data: () => v }; }, delete: async () => { d.delete(`${c}/${id}`); } }), get: async () => ({ docs: [...d.entries()].filter(([k]) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }), where() { return this; }, orderBy() { return this; }, limit() { return this; } }); return { collection: col }; }

test('planejar_mes com dados reais do banco', async () => {
  const b = banco(); P.deps.db = () => b; P.deps.agora = () => new Date('2026-11-20T12:00:00Z');
  const A = (x) => P.agir('u', x);
  await A({ acao: 'conta_salvar', nome: 'Corrente', tipo: 'corrente', saldo: 4000 });
  await A({ acao: 'conta_salvar', nome: 'Poupança', tipo: 'poupanca', saldo: 3000 });
  await A({ acao: 'doc_confirmar', lancamentos: [
    { data: '2026-08-10', descricao: 'Mercado ago', valor: 3000, tipo: 'despesa', categoria: 'alimentacao' },
    { data: '2026-09-10', descricao: 'Mercado set', valor: 3000, tipo: 'despesa', categoria: 'alimentacao' },
    { data: '2026-10-10', descricao: 'Mercado out', valor: 3000, tipo: 'despesa', categoria: 'alimentacao' },
    { data: '2026-11-15', descricao: 'Farmácia', valor: 300, tipo: 'despesa', categoria: 'saude' },
    { data: '2026-11-28', descricao: 'Aluguel', valor: 1000, tipo: 'despesa', categoria: 'moradia' }] });
  const p = (await A({ acao: 'planejar_mes' }))[1];
  assert.equal(p.reserva.gasto_mensal, 3000, 'média por MÊS das despesas dos 3 meses');
  assert.equal(p.reserva.alvo, 18000); assert.equal(p.reserva.guardado, 3000);
  assert.equal(p.fim_mes.pode_hoje, 545.45, '(7000 − 1000 a pagar) / 11 dias');
  assert.ok(p.calendario.some((x) => x.nome === 'Aluguel' && x.tipo === 'saida' && x.data === '2026-11-28'));
  assert.deepEqual((await A({ acao: 'reserva_status' }))[1], p.reserva);
});
