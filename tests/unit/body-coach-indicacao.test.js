'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { premiarIndicacao } = require('../../netlify/functions/body-coach/indicacao.js');

// banco de mentira: só o que premiarIndicacao usa (doc get/set e busca pelo começo do id)
function fakeDb() {
  const dados = {};
  const col = (path) => ({
    doc: (id) => ({
      get: async () => ({ id, exists: !!(dados[path] || {})[id], data: () => (dados[path] || {})[id] }),
      set: async (v, o) => { (dados[path] ||= {})[id] = o && o.merge ? { ...((dados[path] || {})[id] || {}), ...v } : v; },
      collection: (sub) => col(`${path}/${id}/${sub}`),
    }),
    orderBy: () => ({
      startAt: (a) => ({ endAt: () => ({ limit: (k) => ({ get: async () => ({ docs: Object.keys(dados[path] || {}).sort().filter((id) => id.startsWith(a)).slice(0, k).map((id) => ({ id, data: () => dados[path][id] })) }) }) }) }),
    }),
  });
  return { collection: col, dados };
}

function montar() {
  const db = fakeDb();
  const liberados = [];
  const liberar = async (_db, uid, dias) => { liberados.push([uid, dias]); return Date.now() + dias * 86400000; };
  db.dados.bc_diretorio = { indicador1234567: { nome: 'Gil' }, pagante99: { nome: 'Ana' } };
  return { db, liberados, liberar };
}

test('BCI1. premia quem indicou com 30 dias, uma vez só', async () => {
  const { db, liberados, liberar } = montar();
  db.dados['bodycoach_users/pagante99/profile'] = { main: { indicado_por: 'indicador1' } };
  assert.equal(await premiarIndicacao(db, 'pagante99', liberar), true);
  assert.deepEqual(liberados, [['indicador1234567', 30]]);
  assert.equal(db.dados.bc_diretorio.indicador1234567.indicacoesPagas, 1);
  assert.equal(db.dados['bodycoach_users/pagante99/profile'].main.indicacao_premiada, true);
  assert.equal(await premiarIndicacao(db, 'pagante99', liberar), false, 'não premia de novo');
  assert.equal(liberados.length, 1);
  assert.equal(db.dados.bc_diretorio.indicador1234567.indicacoesPagas, 1);
});

test('BCI2. não premia a si mesmo nem sem indicação', async () => {
  const { db, liberados, liberar } = montar();
  db.dados['bodycoach_users/pagante99/profile'] = { main: { indicado_por: 'pagante99' } };
  assert.equal(await premiarIndicacao(db, 'pagante99', liberar), false);
  db.dados['bodycoach_users/outro/profile'] = { main: {} };
  assert.equal(await premiarIndicacao(db, 'outro', liberar), false);
  db.dados['bodycoach_users/outro/profile'] = { main: { indicado_por: 'naoexiste' } };
  assert.equal(await premiarIndicacao(db, 'outro', liberar), false);
  assert.equal(liberados.length, 0);
});
