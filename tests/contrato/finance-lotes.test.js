'use strict';
// Contrato (redesign fase 3, QA do plano: "Excluir um documento remove também os valores derivados, com confirmação").
// Cada 'doc_confirmar' grava um LOTE: todos os lançamentos gravados naquela vez recebem o campo `lote` (mesmo id) e
// o lote fica em base.collection('lotes').doc(id) = { id, nome, criado_em, qtd, receitas, despesas }.
//  - nome: body.nome (texto até 80) ou, sem nome, 'Documento de DD/MM' (data de hoje).
//  - a resposta de doc_confirmar ganha `lote` (o id). Se nada foi gravado (tudo já existia), não cria lote e lote = null.
//  - 'lote_listar' -> { lotes: [...] } do mais novo para o mais antigo.
//  - 'lote_apagar' { id }: apaga o lote e TODOS os lançamentos com aquele lote; devolve { ok, apagados }.
//    Lote que não existe -> 404. Lançamentos de outros lotes ou sem lote ficam.
// Arquivos: só documentos.js (doc_confirmar) e um módulo novo prumo-lib/lotes.js ligado em extra.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../../netlify/functions/prumo.js');
function banco() { const d = new Map(); const col = (c) => ({ doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { d.set(`${c}/${id}`, v); }, get: async () => { const v = d.get(`${c}/${id}`); return { exists: !!v, data: () => v }; }, delete: async () => { d.delete(`${c}/${id}`); } }), get: async () => ({ docs: [...d.entries()].filter(([k]) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }), where() { return this; }, orderBy() { return this; }, limit() { return this; } }); return { collection: col }; }

test('cada doc_confirmar vira um lote; apagar o lote apaga só os lançamentos dele', async () => {
  const b = banco(); P.deps.db = () => b;
  let t = Date.parse('2026-11-19T12:00:00Z'); P.deps.agora = () => new Date(t += 1000);
  const A = (x) => P.agir('u', x);
  const [, r1] = await A({ acao: 'doc_confirmar', nome: 'Fatura Cartão X', lancamentos: [
    { data: '2026-11-02', descricao: 'Loja A', valor: 100, tipo: 'despesa', categoria: 'compras' },
    { data: '2026-11-03', descricao: 'Loja B', valor: 50.5, tipo: 'despesa', categoria: 'compras' }] });
  assert.equal(r1.gravados, 2);
  assert.ok(r1.lote, 'resposta traz o id do lote');
  const [, r2] = await A({ acao: 'doc_confirmar', lancamentos: [{ data: '2026-11-05', descricao: 'Pix recebido', valor: 300, tipo: 'receita', categoria: 'renda' }] });
  assert.ok(r2.lote && r2.lote !== r1.lote);
  const [, ls] = await A({ acao: 'lote_listar' });
  assert.equal(ls.lotes.length, 2);
  assert.equal(ls.lotes[0].id, r2.lote, 'mais novo primeiro');
  assert.match(ls.lotes[0].nome, /^Documento de 19\/11$/);
  const l1 = ls.lotes.find((x) => x.id === r1.lote);
  assert.equal(l1.nome, 'Fatura Cartão X');
  assert.equal(l1.qtd, 2);
  assert.equal(l1.despesas, 150.5);
  const [, rep] = await A({ acao: 'doc_confirmar', lancamentos: [{ data: '2026-11-02', descricao: 'Loja A', valor: 100, tipo: 'despesa', categoria: 'compras' }] });
  assert.equal(rep.gravados, 0);
  assert.equal(rep.lote, null, 'nada gravado, nada de lote');
  const [st, ap] = await A({ acao: 'lote_apagar', id: r1.lote });
  assert.equal(st, 200);
  assert.equal(ap.apagados, 2);
  const [, lancs] = await A({ acao: 'lanc_listar' });
  assert.deepEqual(lancs.lancamentos.map((x) => x.descricao), ['Pix recebido']);
  assert.equal((await A({ acao: 'lote_listar' }))[1].lotes.length, 1);
  assert.equal((await A({ acao: 'lote_apagar', id: 'nao-existe' }))[0], 404);
});
