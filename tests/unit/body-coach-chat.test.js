'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { handler, executar } = require('../../netlify/functions/body-coach-chat.js');

// banco de mentira em memória (só o que a função usa)
function fakeDb() {
  const dados = {};
  let n = 0;
  const col = (path) => ({
    doc: (id) => ({
      get: async () => ({ id, exists: !!(dados[path] || {})[id], data: () => (dados[path] || {})[id] }),
      set: async (v, o) => { (dados[path] ||= {})[id] = o && o.merge ? { ...((dados[path] || {})[id] || {}), ...v } : v; },
      collection: (sub) => col(`${path}/${id}/${sub}`),
    }),
    add: async (v) => { const id = `m${++n}`; (dados[path] ||= {})[id] = v; return { id }; },
    where: (campo, _op, val) => ({ limit: () => ({ get: async () => ({ docs: Object.entries(dados[path] || {}).filter(([, d]) => d[campo] === val).map(([id, d]) => ({ id, data: () => d })) }) }) }),
    orderBy: () => ({ limit: () => ({ get: async () => ({ docs: Object.entries(dados[path] || {}).map(([id, d]) => ({ id, data: () => d })).sort((a, b) => b.data().em - a.data().em) }) }) }),
  });
  return { collection: col };
}

test('BCC1. sem login é recusado e GET também', async () => {
  assert.equal((await handler({ httpMethod: 'GET', headers: {} })).statusCode, 405);
  assert.equal((await handler({ httpMethod: 'POST', headers: {}, body: '{}' })).statusCode, 401);
});

test('BCC2. aluno entra pelo código do coach e os dois conversam', async () => {
  const db = fakeDb();
  const [, c] = await executar({ acao: 'perfil', papel: 'coach', nome: 'Gil' }, 'coach1', db);
  assert.match(c.perfil.codigo, /^[A-Z2-9]{6}$/);
  await executar({ acao: 'perfil', papel: 'aluno', nome: 'Ana' }, 'aluna1', db);
  assert.equal((await executar({ acao: 'vincular', codigo: 'ZZZZZZ' }, 'aluna1', db))[0], 404);
  assert.equal((await executar({ acao: 'vincular', codigo: c.perfil.codigo }, 'aluna1', db))[0], 200);
  const [, ct] = await executar({ acao: 'contatos' }, 'coach1', db);
  assert.deepEqual(ct.contatos.map((x) => x.uid), ['aluna1']);
  await executar({ acao: 'enviar', com: 'coach1', texto: 'Oi coach' }, 'aluna1', db);
  await new Promise((r) => setTimeout(r, 3));
  await executar({ acao: 'enviar', com: 'aluna1', texto: 'Oi Ana' }, 'coach1', db);
  const [, l] = await executar({ acao: 'ler', com: 'aluna1' }, 'coach1', db);
  assert.deepEqual(l.mensagens.map((m) => m.texto), ['Oi coach', 'Oi Ana']);
});

test('BCC3. quem não é vinculado não lê nem escreve', async () => {
  const db = fakeDb();
  await executar({ acao: 'perfil', papel: 'coach', nome: 'Gil' }, 'coach1', db);
  await executar({ acao: 'perfil', papel: 'aluno', nome: 'Ana' }, 'aluna1', db);
  await executar({ acao: 'perfil', papel: 'aluno', nome: 'Bob' }, 'bob', db);
  assert.equal((await executar({ acao: 'ler', com: 'aluna1' }, 'bob', db))[0], 403);
  assert.equal((await executar({ acao: 'enviar', com: 'coach1', texto: 'x' }, 'bob', db))[0], 403);
  assert.equal((await executar({ acao: 'contatos' }, 'semperfil', db))[0], 409);
});
