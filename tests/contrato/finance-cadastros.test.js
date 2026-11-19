'use strict';
// Contrato (dono 19/11: "não deixa eu apagar... editar... nada"; melhorias 3 e 4): um lugar com TUDO que a pessoa cadastrou,
// apagar em cada item e desfazer o último apagado. Ações em prumo-lib/cadastros.js: cadastros_listar, cadastro_apagar, desfazer.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../../netlify/functions/prumo.js');
function banco() { const d = new Map(); const col = (c) => ({ doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { d.set(`${c}/${id}`, v); }, get: async () => { const v = d.get(`${c}/${id}`); return { exists: !!v, data: () => v }; }, delete: async () => { d.delete(`${c}/${id}`); } }), get: async () => ({ docs: [...d.entries()].filter(([k]) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }), where() { return this; }, orderBy() { return this; }, limit() { return this; } }); return { collection: col }; }
const A = (b) => P.agir('u', b);

test('lista tudo, apaga e desfaz', async () => {
  { const b0 = banco(); P.deps.db = () => b0; } P.deps.agora = () => new Date('2026-11-19T12:00:00Z');
  await A({ acao: 'conta_salvar', nome: 'Conta salário', tipo: 'corrente', saldo: 4200 });
  await A({ acao: 'doc_confirmar', lancamentos: [{ data: '2026-11-10', descricao: 'Mercado', valor: 450, tipo: 'despesa', categoria: 'alimentacao' }] });
  await A({ acao: 'pagamento_salvar', tipo: 'adiantamento', mes: '2026-11', data_pagamento: '2026-11-13', liquido: 4434.35 });
  const l = (await A({ acao: 'cadastros_listar' }))[1];
  assert.equal(l.total, 3);
  const lanc = l.grupos.find((g) => g.colecao === 'lancamentos');
  assert.equal(lanc.itens[0].titulo, 'Mercado'); assert.equal(lanc.itens[0].valor, 450); assert.equal(lanc.aba, 'documentos');
  assert.equal(l.grupos.find((g) => g.colecao === 'pagamentos').itens[0].titulo, 'Adiantamento');
  const ap = await A({ acao: 'cadastro_apagar', colecao: 'lancamentos', id: lanc.itens[0].id });
  assert.equal(ap[0], 200);
  assert.equal((await A({ acao: 'cadastros_listar' }))[1].total, 2);
  assert.equal((await A({ acao: 'desfazer' }))[0], 200);
  const l2 = (await A({ acao: 'cadastros_listar' }))[1];
  assert.equal(l2.total, 3, 'desfazer devolveu'); assert.equal(l2.pode_desfazer, false);
});
