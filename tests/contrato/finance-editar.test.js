'use strict';
// Contrato (dono 19/11: "não deixa editar"; melhoria 3): lançamento e cartão podem ser EDITADOS na tela, não só apagados.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../../netlify/functions/prumo.js');
const ler = (f) => fs.readFileSync(path.join(__dirname, '../..', f), 'utf8');
function banco() { const d = new Map(); const col = (c) => ({ doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { d.set(`${c}/${id}`, v); }, get: async () => { const v = d.get(`${c}/${id}`); return { exists: !!v, data: () => v }; }, delete: async () => { d.delete(`${c}/${id}`); } }), get: async () => ({ docs: [...d.entries()].filter(([k]) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }), where() { return this; }, orderBy() { return this; }, limit() { return this; } }); return { collection: col }; }

test('lanc_editar troca valor e descrição sem duplicar', async () => {
  const b = banco(); P.deps.db = () => b; P.deps.agora = () => new Date('2026-11-19T12:00:00Z');
  await P.agir('u', { acao: 'doc_confirmar', lancamentos: [{ data: '2026-11-10', descricao: 'Mercdo', valor: 45, tipo: 'despesa', categoria: 'alimentacao' }] });
  const l = (await P.agir('u', { acao: 'lanc_listar', mes: '2026-11' }))[1].lancamentos[0];
  const r = await P.agir('u', { acao: 'lanc_editar', id: l.id, descricao: 'Mercado', valor: 450 });
  assert.equal(r[0], 200);
  const ls = (await P.agir('u', { acao: 'lanc_listar', mes: '2026-11' }))[1].lancamentos;
  assert.equal(ls.length, 1, 'não duplicou'); assert.equal(ls[0].descricao, 'Mercado'); assert.equal(ls[0].valor, 450);
  assert.equal((await P.agir('u', { acao: 'lanc_editar', id: 'nao-existe', valor: 1 }))[0], 404);
});

test('telas têm ✏️ em lançamento e cartão', () => {
  assert.match(ler('prumo/documentos.js'), /data-editar=/); assert.match(ler('prumo/documentos.js'), /MB\.api\('lanc_editar'/);
  assert.match(ler('prumo/cartoes.js'), /data-editar-cartao=/);
});
