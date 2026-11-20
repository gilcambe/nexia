'use strict';
// Dono 20/11: cadastrar vale refeição (Ticket etc.) com saldo e recarga, lançar gasto nele.
// Recarga entra sozinha no dia; gasto no vale vira lançamento de alimentação e não mexe no "Tenho".
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../../netlify/functions/prumo.js');
const { comRecarga } = require('../../netlify/functions/prumo-lib/vales');
function banco() { const d = new Map(); const col = (c) => ({ doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { d.set(`${c}/${id}`, v); }, get: async () => { const v = d.get(`${c}/${id}`); return { exists: !!v, data: () => v }; }, delete: async () => { d.delete(`${c}/${id}`); } }), get: async () => ({ docs: [...d.entries()].filter(([k]) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }), where() { return this; }, orderBy() { return this; }, limit() { return this; } }); return { collection: col }; }

test('recarga entra uma vez por mês, no dia', () => {
  const v = { saldo: 100, recarga: 800, dia_recarga: 25, ultima_recarga: '2026-11' };
  assert.equal(comRecarga(v, '2026-11-28'), v);
  assert.equal(comRecarga(v, '2026-12-24'), v);
  assert.deepEqual(comRecarga(v, '2026-12-25'), { ...v, saldo: 900, ultima_recarga: '2026-12' });
});

test('cadastrar vale, lançar gasto e ver o saldo; Tenho não muda', async () => {
  const b = banco(); P.deps.db = () => b;
  let t = Date.parse('2026-11-20T12:00:00Z'); P.deps.agora = () => new Date(t += 1000);
  const A = (x) => P.agir('u', x);
  await A({ acao: 'conta_salvar', nome: 'Corrente', tipo: 'corrente', saldo: 1000 });
  const [st, s] = await A({ acao: 'vale_salvar', nome: 'Ticket Restaurante', tipo: 'refeicao', saldo: '350,00', recarga: '900', dia_recarga: 1 });
  assert.equal(st, 200);
  const [, g] = await A({ acao: 'vale_gasto', id: s.id, valor: '42,90', descricao: 'Almoço' });
  assert.equal(g.saldo, 307.1);
  const [, l] = await A({ acao: 'vale_listar' });
  assert.equal(l.vales[0].saldo, 307.1);
  assert.equal(l.vales[0].nome, 'Ticket Restaurante');
  const [, p] = await A({ acao: 'painel_resumo' });
  assert.equal(p.kpis.tenho, 1000, 'gasto no vale não sai da conta');
  assert.ok(p.ultimos.some((x) => x.descricao === 'Almoço'));
  assert.equal((await A({ acao: 'vale_salvar', nome: '' }))[0], 400);
  assert.equal((await A({ acao: 'vale_gasto', id: 'nao', valor: 10 }))[0], 404);
});
