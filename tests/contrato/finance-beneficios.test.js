'use strict';
// Redesign fase 6: 'beneficios_resumo' dá o valor dos pontos (saldo ÷ 1.000 × milheiro), ordena pelo vencimento e
// separa o que vence em 30, 60 e 90 dias.
const test = require('node:test');
const assert = require('node:assert/strict');
const { resumoPontos } = require('../../netlify/functions/prumo-lib/beneficios');
const P = require('../../netlify/functions/prumo.js');
function banco() { const d = new Map(); const col = (c) => ({ doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { d.set(`${c}/${id}`, v); }, get: async () => { const v = d.get(`${c}/${id}`); return { exists: !!v, data: () => v }; }, delete: async () => { d.delete(`${c}/${id}`); } }), get: async () => ({ docs: [...d.entries()].filter(([k]) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }), where() { return this; }, orderBy() { return this; }, limit() { return this; } }); return { collection: col }; }

test('valor dos pontos e faixas 30/60/90', () => {
  const r = resumoPontos([
    { id: 'a', programa: 'Programa A', saldo: 10000, valor_milheiro: 20, validade: '2026-12-10' },
    { id: 'b', programa: 'Programa B', saldo: 50000, valor_milheiro: 14, validade: '2027-01-30' },
    { id: 'c', programa: 'Programa C', saldo: 5000, valor_milheiro: 10, validade: null },
  ], '2026-11-19');
  assert.equal(r.total_pontos, 65000);
  assert.equal(r.valor_estimado, 200 + 700 + 50);
  assert.deepEqual(r.programas.map((p) => p.id), ['a', 'b', 'c']);
  assert.deepEqual(r.vencendo.map((p) => [p.id, p.faixa]), [['a', 30], ['b', 90]]);
});

test('ação beneficios_resumo ligada', async () => {
  const b = banco(); P.deps.db = () => b; P.deps.agora = () => new Date('2026-11-19T12:00:00Z');
  await P.agir('u', { acao: 'pontos_salvar', programa: 'Programa A', saldo: 2000, valor_milheiro: 25, validade: '2026-12-01' });
  const [st, r] = await P.agir('u', { acao: 'beneficios_resumo' });
  assert.equal(st, 200);
  assert.equal(r.valor_estimado, 50);
  assert.equal(r.vencendo.length, 1);
});
