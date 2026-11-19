'use strict';
// Contrato (melhoria 8, dono 19/11: categorizar gastos sozinho): a correção de categoria que a pessoa faz vira regra e é
// usada nos próximos documentos (doc_ler) e extratos (extrato_ler) do mesmo estabelecimento.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../../netlify/functions/prumo.js');
function banco() { const d = new Map(); const col = (c) => ({ doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { d.set(`${c}/${id}`, v); }, get: async () => { const v = d.get(`${c}/${id}`); return { exists: !!v, data: () => v }; }, delete: async () => { d.delete(`${c}/${id}`); } }), get: async () => ({ docs: [...d.entries()].filter(([k]) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }), where() { return this; }, orderBy() { return this; }, limit() { return this; } }); return { collection: col }; }

test('corrigir a categoria ensina o app para o próximo extrato', async () => {
  const b = banco(); P.deps.db = () => b; P.deps.agora = () => new Date('2026-11-20T12:00:00Z');
  await P.agir('u', { acao: 'doc_confirmar', lancamentos: [{ data: '2026-11-05', descricao: 'PADARIA DO ZE 123', valor: 20, tipo: 'despesa', categoria: 'outros' }] });
  const l = (await P.agir('u', { acao: 'lanc_listar', mes: '2026-11' }))[1].lancamentos[0];
  assert.equal((await P.agir('u', { acao: 'lanc_editar', id: l.id, categoria: 'alimentacao' }))[0], 200);
  const csv = 'Data;Descrição;Valor\n10/11/2026;PADARIA DO ZE 456;-12,50\n11/11/2026;POSTO SHELL;-100,00\n';
  const r = (await P.agir('u', { acao: 'extrato_ler', nome: 'x.csv', conteudo: csv }))[1];
  assert.equal(r.prontos.find((x) => /PADARIA/.test(x.descricao)).categoria, 'alimentacao', 'aprendeu');
  assert.equal(r.prontos.find((x) => /SHELL/.test(x.descricao)).categoria, 'outros', 'não mexe no resto');
});
