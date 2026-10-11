'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { executar } = require('../../netlify/functions/body-coach-chat.js');

// banco de mentira com where/orderBy/limit encadeados
function fakeDb() {
  const dados = {};
  let n = 0;
  const lista = (path) => Object.entries(dados[path] || {}).map(([id, d]) => ({ id, data: () => d }));
  const consulta = (path, filtros = [], ordem = null, lim = 1000) => ({
    where: (c, op, v) => consulta(path, [...filtros, [c, op, v]], ordem, lim),
    orderBy: (c, dir = 'asc') => consulta(path, filtros, [c, dir], lim),
    limit: (k) => consulta(path, filtros, ordem, k),
    get: async () => {
      let docs = lista(path).filter((d) => filtros.every(([c, op, v]) => (op === '==' ? d.data()[c] === v : op === '<' ? d.data()[c] < v : op === 'array-contains' ? (d.data()[c] || []).includes(v) : true)));
      if (ordem) docs = docs.sort((a, b) => (a.data()[ordem[0]] > b.data()[ordem[0]] ? 1 : -1) * (ordem[1] === 'desc' ? -1 : 1));
      return { docs: docs.slice(0, lim) };
    },
  });
  const col = (path) => ({
    ...consulta(path),
    doc: (id) => ({
      get: async () => ({ id, exists: !!(dados[path] || {})[id], data: () => (dados[path] || {})[id] }),
      set: async (v, o) => { (dados[path] ||= {})[id] = o && o.merge ? { ...((dados[path] || {})[id] || {}), ...v } : v; },
      delete: async () => { delete (dados[path] || {})[id]; },
      collection: (sub) => col(`${path}/${id}/${sub}`),
    }),
    add: async (v) => { const id = `m${++n}`; (dados[path] ||= {})[id] = v; return { id }; },
  });
  return { collection: col, dados };
}
async function montar() {
  const db = fakeDb();
  const [, c] = await executar({ acao: 'perfil', papel: 'coach', nome: 'Gil' }, 'coach1', db);
  for (const [id, nome] of [['ana', 'Ana'], ['bob', 'Bob'], ['eva', 'Eva']]) {
    await executar({ acao: 'perfil', papel: 'aluno', nome }, id, db);
    if (id !== 'eva') await executar({ acao: 'vincular', codigo: c.perfil.codigo }, id, db);
  }
  await executar({ acao: 'ranking_config', participar: true, apelido: 'Aninha' }, 'ana', db);
  return db;
}

test('BCC1. pontos: refeição (até 5/dia), check-in (1/dia) e treino com retorno contam no ranking', async () => {
  const db = await montar();
  for (let i = 0; i < 7; i++) await executar({ acao: 'pontos_marcar', tipo: 'refeicao' }, 'ana', db);
  await executar({ acao: 'pontos_marcar', tipo: 'checkin' }, 'ana', db);
  const [, r2] = await executar({ acao: 'pontos_marcar', tipo: 'checkin' }, 'ana', db);
  assert.equal(r2.contou, false);
  await executar({ acao: 'treino_feito', minutos: 40, esforco: 3 }, 'ana', db);
  const [, rk] = await executar({ acao: 'ranking_ver' }, 'ana', db);
  const ana = rk.lista.find((l) => l.eu);
  assert.deepEqual({ r: ana.refeicoes, c: ana.checkins, f: ana.feedbacks, t: ana.treinos }, { r: 5, c: 1, f: 1, t: 1 });
  assert.equal(ana.pontos, 10 + 4 + 5 * 2 + 2 + 3);
});

test('BCC2. ranking de carga: base na 1ª vez, ganho % por exercício e geral; só quem participa aparece para colegas', async () => {
  const db = await montar();
  await executar({ acao: 'treino_feito', minutos: 30, melhores: [{ ex: 'Supino reto', grupo: 'peito', kg: 40, reps: 10 }, { ex: 'Agachamento', grupo: 'quadriceps', kg: 60, reps: 8 }] }, 'ana', db);
  await executar({ acao: 'treino_feito', minutos: 30, melhores: [{ ex: 'Supino reto', grupo: 'peito', kg: 30, reps: 10 }] }, 'bob', db);
  await new Promise((r) => setTimeout(r, 5));
  await executar({ acao: 'treino_feito', minutos: 30, melhores: [{ ex: 'Supino reto', kg: 44, reps: 10 }, { ex: 'Agachamento', kg: 50, reps: 8 }] }, 'ana', db);
  await executar({ acao: 'treino_feito', minutos: 30, melhores: [{ ex: 'Supino reto', kg: 36, reps: 10 }, { ex: 'lixo', kg: -5, reps: 3 }] }, 'bob', db);
  const p = db.dados.bc_diretorio.ana.progressao;
  assert.equal(p.supino_reto.base.rm, 53.3);
  assert.equal(p.supino_reto.melhor.kg, 44);
  assert.equal(p.agachamento.melhor.kg, 60, 'carga menor não vira recorde');
  // coach vê todos
  const [, rc] = await executar({ acao: 'ranking_carga', exercicio: 'supino_reto' }, 'coach1', db);
  assert.deepEqual(rc.lista.map((l) => [l.nome, l.ganho]), [['Bob', 20], ['Aninha', 10.1]]);
  assert.equal(rc.exercicios[0].id, 'supino_reto');
  assert.equal(rc.exercicios[0].pessoas, 2);
  // Ana não vê o Bob (ele não participa do ranking)
  const [, ra] = await executar({ acao: 'ranking_carga', exercicio: 'supino_reto' }, 'ana', db);
  assert.deepEqual(ra.lista.map((l) => l.nome), ['Aninha']);
  // geral: média dos exercícios que evoluíram
  const [, rg] = await executar({ acao: 'ranking_carga' }, 'coach1', db);
  assert.equal(rg.lista.find((l) => l.nome === 'Aninha').ganho, 10.1);
  assert.equal((await executar({ acao: 'ranking_carga' }, 'eva', db))[1].semEquipe, true);
});

test('BCC3. feed: só a equipe, posta texto/foto, curte, paginação, apaga (autor ou coach)', async () => {
  const db = await montar();
  assert.equal((await executar({ acao: 'feed_ver' }, 'eva', db))[0], 403);
  assert.equal((await executar({ acao: 'feed_postar' }, 'ana', db))[0], 400);
  assert.equal((await executar({ acao: 'feed_postar', texto: 'oi', imagem: 'data:text/html;base64,AAA' }, 'ana', db))[0], 400);
  const FOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';
  const [, p1] = await executar({ acao: 'feed_postar', texto: 'Primeiro treino da semana!', imagem: FOTO }, 'ana', db);
  for (let i = 0; i < 11; i++) { await new Promise((r) => setTimeout(r, 2)); await executar({ acao: 'feed_postar', texto: `post ${i}` }, 'bob', db); }
  const [, f1] = await executar({ acao: 'feed_ver' }, 'coach1', db);
  assert.equal(f1.posts.length, 10);
  assert.equal(f1.mais, true);
  assert.equal(f1.posts[0].texto, 'post 10', 'mais novo primeiro');
  const [, f2] = await executar({ acao: 'feed_ver', antes: f1.posts.at(-1).em }, 'coach1', db);
  assert.equal(f2.posts.length, 2);
  assert.equal(f2.posts.at(-1).imagem, FOTO);
  const [, c] = await executar({ acao: 'feed_curtir', id: p1.id }, 'bob', db);
  assert.deepEqual(c, { curtidas: 1, curti: true });
  assert.deepEqual((await executar({ acao: 'feed_curtir', id: p1.id }, 'bob', db))[1], { curtidas: 0, curti: false });
  assert.equal((await executar({ acao: 'feed_apagar', id: p1.id }, 'bob', db))[0], 403, 'colega não apaga');
  assert.equal((await executar({ acao: 'feed_apagar', id: p1.id }, 'coach1', db))[0], 200, 'coach apaga');
  assert.equal((await executar({ acao: 'feed_curtir', id: p1.id }, 'bob', db))[0], 404);
});
