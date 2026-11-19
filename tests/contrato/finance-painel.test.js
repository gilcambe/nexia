'use strict';
// Redesign fase 1: 'painel_resumo' é a fonte única da tela Início (score, Tenho, Recebi, A pagar, Pode gastar hoje,
// confiança, até 3 alertas, últimos lançamentos). O adiantamento muda "Falta receber"; uma fatura muda "A pagar" e o
// "Pode gastar" na mesma quantia; sem contas fixas o número vem "estimado".
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../../netlify/functions/prumo.js');
function banco() { const d = new Map(); const col = (c) => ({ doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { d.set(`${c}/${id}`, v); }, get: async () => { const v = d.get(`${c}/${id}`); return { exists: !!v, data: () => v }; }, delete: async () => { d.delete(`${c}/${id}`); } }), get: async () => ({ docs: [...d.entries()].filter(([k]) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }), where() { return this; }, orderBy() { return this; }, limit() { return this; } }); return { collection: col }; }

test('painel vazio: tudo sem dados, nada quebra', async () => {
  const b = banco(); P.deps.db = () => b; P.deps.agora = () => new Date('2026-11-19T12:00:00Z');
  const [st, r] = await P.agir('u', { acao: 'painel_resumo' });
  assert.equal(st, 200);
  assert.equal(r.score.faixa, 'sem_dados');
  assert.equal(r.kpis.estado, 'sem_dados');
  assert.equal(r.dias_restantes, 12);
  assert.ok(r.confianca.pct === 0 && r.confianca.faltam.length === 8);
  assert.ok(r.alertas.length <= 3);
});

test('painel com salário, adiantamento e fatura', async () => {
  const b = banco(); P.deps.db = () => b; P.deps.agora = () => new Date('2026-11-19T12:00:00Z');
  const A = (x) => P.agir('u', x);
  await A({ acao: 'conta_salvar', nome: 'Corrente', tipo: 'corrente', saldo: 5000 });
  await A({ acao: 'salario_config', salario_base: 6000 });
  const [, r0] = await A({ acao: 'painel_resumo' });
  assert.equal(r0.kpis.tenho, 5000);
  assert.equal(r0.kpis.estado, 'estimado');
  assert.ok(r0.kpis.falta_receber > 0);
  await A({ acao: 'pagamento_salvar', tipo: 'adiantamento', mes: '2026-11', data_pagamento: '2026-11-14', liquido: 2500 });
  const [, r1] = await A({ acao: 'painel_resumo' });
  assert.equal(r1.kpis.recebi, 2500);
  assert.equal(r1.kpis.falta_receber, Math.round((r1.kpis.renda - 2500) * 100) / 100, 'falta receber = líquido - adiantamento');
  assert.equal(r1.kpis.posso_mes, Math.round((r1.kpis.tenho + r1.kpis.falta_receber - r1.kpis.a_pagar) * 100) / 100);
  await A({ acao: 'doc_confirmar', lancamentos: [{ data: '2026-11-25', descricao: 'Fatura cartão X', valor: 800.5, tipo: 'despesa', categoria: 'cartao' }] });
  const [, r2] = await A({ acao: 'painel_resumo' });
  assert.equal(Math.round((r2.kpis.a_pagar - r1.kpis.a_pagar) * 100) / 100, 800.5);
  assert.equal(Math.round((r1.kpis.posso_mes - r2.kpis.posso_mes) * 100) / 100, 800.5);
  assert.equal(r2.kpis.estado, 'completo');
  assert.ok(r2.score.pilares.find((x) => x.id === 'fluxo').pontos !== null, 'fluxo medido');
  assert.ok(r2.alertas.length <= 3);
});

test('gasto lançado depois do saldo informado muda o Tenho; compra do cartão não', async () => {
  const b = banco(); P.deps.db = () => b;
  const A = (x) => P.agir('u', x);
  P.deps.agora = () => new Date('2026-11-18T12:00:00Z');
  await A({ acao: 'conta_salvar', nome: 'Corrente', tipo: 'corrente', saldo: 3000 });
  P.deps.agora = () => new Date('2026-11-19T12:00:00Z');
  const [, r0] = await A({ acao: 'painel_resumo' });
  await A({ acao: 'doc_confirmar', lancamentos: [{ data: '2026-11-19', descricao: 'Farmácia', valor: 120.5, tipo: 'despesa', categoria: 'saude' }] });
  await A({ acao: 'doc_confirmar', lancamentos: [{ data: '2026-11-19', descricao: 'Loja no cartão', valor: 300, tipo: 'despesa', categoria: 'compras', documento: 'fatura' }] });
  const [, r1] = await A({ acao: 'painel_resumo' });
  assert.equal(r0.kpis.tenho, 3000);
  assert.equal(r1.kpis.tenho, 2879.5);
  assert.equal(Math.round((r0.kpis.posso_mes - r1.kpis.posso_mes) * 100) / 100, 120.5);
});
