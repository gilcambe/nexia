'use strict';
// Dono 19-20/11: o total da fatura (vence no mês seguinte) tem que aparecer em "Próximos meses"/"Próximas contas".
// fatura_gravar guarda o total no vencimento; as compras lidas do mesmo vencimento não somam de novo; pagar a fatura
// não conta como gasto do mês. doc_ler devolve o total e o vencimento da fatura lida.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../../netlify/functions/prumo.js');
function banco() { const d = new Map(); const col = (c) => ({ doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { d.set(`${c}/${id}`, v); }, get: async () => { const v = d.get(`${c}/${id}`); return { exists: !!v, data: () => v }; }, delete: async () => { d.delete(`${c}/${id}`); } }), get: async () => ({ docs: [...d.entries()].filter(([k]) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }), where() { return this; }, orderBy() { return this; }, limit() { return this; } }); return { collection: col }; }

test('fatura_gravar: aparece no mês do vencimento, sem somar as compras de novo', async () => {
  const b = banco(); P.deps.db = () => b; P.deps.agora = () => new Date('2026-11-20T12:00:00Z');
  const A = (x) => P.agir('u', x);
  await A({ acao: 'doc_confirmar', lancamentos: [{ data: '2026-11-05', vencimento: '2026-12-08', descricao: 'Loja', valor: 300, tipo: 'despesa', categoria: 'compras' }] });
  assert.equal((await A({ acao: 'fatura_gravar', nome: 'Cartão A', valor: '1.250,40', vencimento: '2026-12-08' }))[0], 200);
  await A({ acao: 'fatura_gravar', nome: 'Cartão A', valor: 1260.4, vencimento: '2026-12-08' }); // regravar troca o valor
  const [, p] = await A({ acao: 'painel_resumo' });
  const dez = p.proximos_meses[0];
  assert.equal(dez.mes, '2026-12');
  assert.deepEqual(dez.itens.map((x) => [x.nome, x.valor]), [['Fatura Cartão A', 1260.4]]);
  assert.deepEqual(p.proximas_contas.map((x) => x.valor), [1260.4]);
  assert.equal(p.kpis.gasto_mes, 300);
  assert.equal((await A({ acao: 'fatura_gravar', valor: 10 }))[0], 400);
});

test('doc_ler devolve o total e o vencimento da fatura', async () => {
  const b = banco(); P.deps.db = () => b; P.deps.agora = () => new Date('2026-11-20T12:00:00Z');
  P.deps.perguntarVisao = async () => JSON.stringify({ tipo_documento: 'fatura', instituicao: 'Banco X', total_documento: '1.234,56', vencimento_documento: '08/12/2026',
    lancamentos: [{ data: '2026-11-03', descricao: 'Mercado', valor: 100, tipo: 'despesa', categoria: 'alimentacao' }] });
  const img = 'data:image/png;base64,' + Buffer.from('x'.repeat(200)).toString('base64');
  const [st, r] = await P.agir('u', { acao: 'doc_ler', imagens: [img] });
  delete P.deps.perguntarVisao;
  assert.equal(st, 200, JSON.stringify(r));
  assert.deepEqual(r.fatura, { total: 1234.56, vencimento: '2026-12-08', instituicao: 'Banco X' });
});
