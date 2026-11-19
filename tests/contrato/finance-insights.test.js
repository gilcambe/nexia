'use strict';
// Redesign fase 7 (plano, seção 14): motor de decisões. Cada dica traz o dado usado, uma frase e uma ação; risco
// vem antes de atenção, que vem antes de info. Na Home, no máximo 3, e "dispensar" esconde a dica.
const test = require('node:test');
const assert = require('node:assert/strict');
const { gerarInsights, mesesAte } = require('../../netlify/functions/prumo-lib/insights');
const P = require('../../netlify/functions/prumo.js');
function banco() { const d = new Map(); const col = (c) => ({ doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { d.set(`${c}/${id}`, v); }, get: async () => { const v = d.get(`${c}/${id}`); return { exists: !!v, data: () => v }; }, delete: async () => { d.delete(`${c}/${id}`); } }), get: async () => ({ docs: [...d.entries()].filter(([k]) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }), where() { return this; }, orderBy() { return this; }, limit() { return this; } }); return { collection: col }; }

test('gatilhos do plano, com o dado usado, em ordem de urgência', () => {
  const r = gerarInsights({ tenho: 500, gasto_mensal: 3000, reserva_meses: 1, mes_num: 11, investido: 0,
    faturas: [{ nome: 'Fatura X', valor: 1200, dias: 3 }], dividas: [{ credor: 'Banco', tipo: 'cheque_especial', saldo: 1000, juros_mes: 8 }],
    pontos: [{ programa: 'Prog', saldo: 10000, dias: 20, valor: 200 }], categorias: [{ categoria: 'alimentacao', valor: 1300, media3: 1000 }] });
  const ids = r.map((x) => x.id);
  assert.deepEqual(ids.slice(0, 2).sort(), ['fatura-Fatura X', 'rotativo']);
  assert.ok(ids.includes('reserva') && ids.includes('pontos-Prog') && ids.includes('cat-alimentacao'));
  for (const x of r) { assert.ok(x.texto && x.dado && x.acao && x.acao.aba, x.id); }
  assert.match(r.find((x) => x.id === 'fatura-Fatura X').texto, /Faltam R\$ 700,00/);
  assert.match(r.find((x) => x.id === 'cat-alimentacao').texto, /Mercado e comida está 30% acima/);
  assert.equal(r.findIndex((x) => x.nivel === 'info') > r.findIndex((x) => x.nivel === 'atencao'), true);
});

test('dinheiro parado e aporte extra', () => {
  const r = gerarInsights({ tenho: 20000, gasto_mensal: 4000, reserva_meses: 6, investido: 10000, aporte_mensal: 0, mes_num: 7 });
  assert.ok(r.some((x) => x.id === 'parado'));
  assert.ok(r.some((x) => x.id === 'aporte-500'));
  assert.equal(mesesAte(100, 0, 50), 0);
  assert.equal(mesesAte(0, 0, 50), null);
});

test('painel: no máximo 3 avisos e dispensar esconde', async () => {
  const b = banco(); P.deps.db = () => b; P.deps.agora = () => new Date('2026-11-19T12:00:00Z');
  const A = (x) => P.agir('u', x);
  await A({ acao: 'conta_salvar', nome: 'Corrente', tipo: 'corrente', saldo: 100 });
  await A({ acao: 'divida_salvar', credor: 'Banco', tipo: 'cheque_especial', saldo: 900, juros_mes: 8, parcela: 100, dia_vencimento: 21 });
  const [, r0] = await A({ acao: 'painel_resumo' });
  assert.ok(r0.alertas.length <= 3);
  const rot = r0.alertas.find((x) => x.id === 'rotativo');
  assert.ok(rot && rot.dado && rot.dispensavel);
  await A({ acao: 'insight_dispensar', id: 'rotativo' });
  const [, r1] = await A({ acao: 'painel_resumo' });
  assert.ok(!r1.alertas.some((x) => x.id === 'rotativo'));
});

test('assistente: "posso comprar X?" usa os números do Início e cita a conta', async () => {
  const b = banco(); P.deps.db = () => b; P.deps.agora = () => new Date('2026-11-19T12:00:00Z');
  const A = (x) => P.agir('u', x);
  await A({ acao: 'conta_salvar', nome: 'C', tipo: 'corrente', saldo: 5000 });
  const [, s] = await A({ acao: 'assistente_perguntar', texto: 'Posso comprar um celular de R$ 1.500?' });
  assert.match(s.resposta, /^Cabe: .*R\$ 3\.500,00 no mês/);
  assert.match(s.resposta, /Números usados: Tenho R\$ 5\.000,00/);
  const [, n] = await A({ acao: 'assistente_perguntar', texto: 'posso comprar uma TV de 9 mil?' });
  assert.match(n.resposta, /^Agora não cabe: faltariam R\$ 4\.000,00/);
});
