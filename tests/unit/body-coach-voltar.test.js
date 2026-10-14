'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const push = require('../../netlify/functions/body-coach/push.js');
const { avisarQuemSumiu } = require('../../netlify/functions/body-coach/voltar.js');
const { rodarLembretes } = require('../../netlify/functions/body-coach/lembretes.js');

function fakeDb() {
  const dados = {};
  const lista = (path) => Object.entries(dados[path] || {}).map(([id, d]) => ({ id, data: () => d }));
  const col = (path) => ({
    doc: (id) => ({
      get: async () => ({ id, exists: !!(dados[path] || {})[id], data: () => (dados[path] || {})[id] }),
      set: async (v, o) => { (dados[path] ||= {})[id] = o && o.merge ? { ...((dados[path] || {})[id] || {}), ...v } : v; },
    }),
    limit: () => ({ get: async () => ({ docs: lista(path) }) }),
    where: (campo, op, val) => ({ limit: () => ({ get: async () => ({ docs: lista(path).filter((d) => (op === 'array-contains' ? (d.data()[campo] || []).includes(val) : d.data()[campo] === val)) }) }) }),
  });
  return { collection: col, dados };
}

const DIA = 86400000;
const AGORA = Date.parse('2026-10-14T21:00:00Z'); // 18:00 em Brasília

function preparar(diasSemTreinar) {
  const db = fakeDb();
  db.dados.bc_push = { ana: { subs: [{ endpoint: 'x' }] } };
  db.dados.bc_diretorio = { ana: { ultimoTreino: AGORA - diasSemTreinar * DIA } };
  return db;
}

function espiar(t) {
  const enviados = [];
  const original = push.avisar;
  push.avisar = async (db, uid, conteudo) => { enviados.push({ uid, conteudo }); return 1; };
  t.after(() => { push.avisar = original; });
  return enviados;
}

test('voltar: avisa quem está há 4 dias sem treinar', async (t) => {
  const enviados = espiar(t);
  const db = preparar(4);
  assert.equal(await avisarQuemSumiu(db, AGORA), 1);
  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].conteudo.tag, 'volta');
  assert.equal(enviados[0].conteudo.url, 'workout');
  assert.match(enviados[0].conteudo.corpo, /Faz 4 dias/);
  assert.equal(db.dados.bc_push.ana.ultimoAvisoVolta, '2026-10-14');
});

test('voltar: não avisa quem treinou ontem nem quem sumiu há mais de 30 dias', async (t) => {
  const enviados = espiar(t);
  assert.equal(await avisarQuemSumiu(preparar(1), AGORA), 0);
  assert.equal(await avisarQuemSumiu(preparar(40), AGORA), 0);
  assert.equal(enviados.length, 0);
});

test('voltar: não avisa 2 vezes em 3 dias', async (t) => {
  const enviados = espiar(t);
  const db = preparar(4);
  assert.equal(await avisarQuemSumiu(db, AGORA), 1);
  assert.equal(await avisarQuemSumiu(db, AGORA), 0);
  assert.equal(await avisarQuemSumiu(db, AGORA + 3 * DIA), 0);
  assert.equal(await avisarQuemSumiu(db, AGORA + 4 * DIA), 1);
  assert.equal(enviados.length, 2);
});

test('voltar: rodarLembretes só chama às 18:00', async (t) => {
  espiar(t);
  const db = preparar(5);
  assert.equal((await rodarLembretes(db, AGORA)).volta, 1);
  assert.equal((await rodarLembretes(preparar(5), AGORA - 3600000)).volta, undefined);
});
