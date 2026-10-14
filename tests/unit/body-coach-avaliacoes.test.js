'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { executar, lojaVer, depoimentosPublicos } = require('../../netlify/functions/body-coach-chat.js');

// banco de mentira em memória (só o que as funções usam)
function fakeDb() {
  const dados = {};
  let n = 0;
  const lista = (path) => Object.entries(dados[path] || {}).map(([id, d]) => ({ id, data: () => d }));
  const col = (path) => ({
    doc: (id) => ({
      get: async () => ({ id, exists: !!(dados[path] || {})[id], data: () => (dados[path] || {})[id] }),
      set: async (v, o) => { (dados[path] ||= {})[id] = o && o.merge ? { ...((dados[path] || {})[id] || {}), ...v } : v; },
      delete: async () => { delete (dados[path] || {})[id]; },
      collection: (sub) => col(`${path}/${id}/${sub}`),
    }),
    add: async (v) => { const id = `m${++n}`; (dados[path] ||= {})[id] = v; return { id }; },
    where: (campo, op, val) => ({ limit: () => ({ get: async () => ({ docs: lista(path).filter((d) => d.data()[campo] === val) }) }) }),
    orderBy: (campo) => ({ limit: (k) => ({ get: async () => ({ docs: lista(path).sort((a, b) => (b.data()[campo] || 0) - (a.data()[campo] || 0)).slice(0, k) }) }) }),
  });
  return { collection: col, dados };
}

test('BCAV1. avaliar: nota de 1 a 5, uma por pessoa; só o admin vê e aprova; público só aprovados 4+', async () => {
  const db = fakeDb();
  await executar({ acao: 'perfil', papel: 'aluno', nome: 'Ana Souza' }, 'ana', db);
  await executar({ acao: 'perfil', papel: 'aluno', nome: 'Bob Lima' }, 'bob', db);
  assert.equal((await executar({ acao: 'avaliar', estrelas: 9 }, 'ana', db))[0], 400);
  assert.equal((await executar({ acao: 'avaliar', estrelas: 5, texto: 'Mudou meu treino!', publicar: true }, 'ana', db))[0], 200);
  await executar({ acao: 'avaliar', estrelas: 2, texto: 'Falta exercício', publicar: true }, 'bob', db);
  assert.equal(db.dados.bc_avaliacoes.bob.publicar, false, 'nota baixa nunca é publicada');
  assert.equal((await executar({ acao: 'avaliacoes_ver' }, 'ana', db))[0], 403);
  assert.equal((await executar({ acao: 'avaliacao_aprovar', uid: 'ana', aprovado: true }, 'ana', db))[0], 403);
  assert.deepEqual((await depoimentosPublicos(db))[1].depoimentos, []);
  const [s, r] = await executar({ acao: 'avaliacoes_ver' }, 'adm', db, { master: true });
  assert.equal(s, 200);
  assert.equal(r.itens.length, 2);
  assert.equal(r.media, 3.5);
  assert.equal((await executar({ acao: 'avaliacao_aprovar', uid: 'ana', aprovado: true }, 'adm', db, { master: true }))[0], 200);
  await executar({ acao: 'avaliacao_aprovar', uid: 'bob', aprovado: true }, 'adm', db, { master: true });
  assert.deepEqual((await depoimentosPublicos(db))[1].depoimentos, [{ nome: 'Ana', texto: 'Mudou meu treino!', estrelas: 5 }]);
  // trocou o texto: sai do ar até aprovar de novo
  await executar({ acao: 'avaliar', estrelas: 5, texto: 'Outro texto', publicar: true }, 'ana', db);
  assert.deepEqual((await depoimentosPublicos(db))[1].depoimentos, []);
});

test('BCAV2. página do coach: bio, WhatsApp, marca e nº de alunos; sem e-mail', async () => {
  const db = fakeDb();
  const [, c] = await executar({ acao: 'perfil', papel: 'coach', nome: 'Gil' }, 'coach1', db);
  assert.equal((await executar({ acao: 'marca_salvar', nome: 'Studio Gil', cor: 'azul', whats: '123' }, 'coach1', db))[0], 400);
  const [sm, m] = await executar({ acao: 'marca_salvar', nome: 'Studio Gil', cor: 'azul', bio: '  Personal há 8 anos. '.padEnd(400, 'x'), whats: '(81) 99999-8888' }, 'coach1', db);
  assert.equal(sm, 200);
  assert.equal(m.whats, '81999998888');
  assert.equal(m.codigo, c.perfil.codigo);
  assert.equal((await executar({ acao: 'marca_ver' }, 'coach1', db))[1].bio.length, 300);
  db.dados.bc_diretorio.coach1.email = 'gil@x.com';
  for (const id of ['a1', 'a2', 'a3']) {
    await executar({ acao: 'perfil', papel: 'aluno', nome: id }, id, db);
    await executar({ acao: 'vincular', codigo: c.perfil.codigo }, id, db);
  }
  const [s, loja] = await lojaVer({ codigo: c.perfil.codigo }, db);
  assert.equal(s, 200);
  assert.equal(loja.coach.alunos, 3);
  assert.equal(loja.coach.whats, '81999998888');
  assert.equal(loja.coach.marca.nome, 'Studio Gil');
  assert.equal(loja.coach.bio.length, 300);
  assert.equal(JSON.stringify(loja).includes('gil@x.com'), false);
});

test('BCAV3. pedido do Premium guarda plano e valor', async () => {
  const db = fakeDb();
  await executar({ acao: 'perfil', papel: 'aluno', nome: 'Ana' }, 'ana', db);
  assert.equal((await executar({ acao: 'acesso_paguei', plano: 'anual', valor: 179 }, 'ana', db))[0], 200);
  const pedido = Object.values(db.dados.bc_acesso_pedidos)[0];
  assert.deepEqual({ plano: pedido.plano, valor: pedido.valor, dias: pedido.dias }, { plano: 'anual', valor: 179, dias: 365 });
  assert.equal((await executar({ acao: 'indicacao_ver' }, 'ana', db))[1].pagas, 0);
});
