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
    where: (campo, op, val) => op === '>' ? ({ orderBy: () => ({ limit: () => ({ get: async () => ({ docs: Object.entries(dados[path] || {}).filter(([, d]) => d[campo] > val).map(([id, d]) => ({ id, data: () => d })).sort((a, b) => a.data().em - b.data().em) }) }) }) }) : ({ limit: () => ({ get: async () => ({ docs: Object.entries(dados[path] || {}).filter(([, d]) => d[campo] === val).map(([id, d]) => ({ id, data: () => d })) }) }) }),
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

test('BCC4. vídeo do aluno chega só ao coach; demo do coach aparece para o aluno', async () => {
  const db = fakeDb();
  const v = 'data:video/webm;codecs=vp8;base64,QUJD';
  const [, c] = await executar({ acao: 'perfil', papel: 'coach', nome: 'Gil' }, 'coach1', db);
  await executar({ acao: 'perfil', papel: 'aluno', nome: 'Ana' }, 'aluna1', db);
  await executar({ acao: 'perfil', papel: 'aluno', nome: 'Bob' }, 'bob', db);
  await executar({ acao: 'vincular', codigo: c.perfil.codigo }, 'aluna1', db);
  assert.equal((await executar({ acao: 'video_enviar', com: 'coach1', video: 'http://x' }, 'aluna1', db))[0], 400);
  const [st, env] = await executar({ acao: 'video_enviar', com: 'coach1', video: v, texto: 'meu agachamento' }, 'aluna1', db);
  assert.equal(st, 200);
  assert.equal((await executar({ acao: 'video_ver', id: env.mensagem.video }, 'coach1', db))[1].video, v);
  assert.equal((await executar({ acao: 'video_ver', id: env.mensagem.video }, 'bob', db))[0], 404);
  assert.equal((await executar({ acao: 'demo_salvar', exercicio: 'agachamento', video: v }, 'aluna1', db))[0], 403);
  await executar({ acao: 'demo_salvar', exercicio: 'agachamento', video: v }, 'coach1', db);
  assert.equal((await executar({ acao: 'demo_ver', exercicio: 'agachamento' }, 'aluna1', db))[1].video, v);
  assert.equal((await executar({ acao: 'demo_ver', exercicio: 'agachamento' }, 'bob', db))[1].video, null);
});

test('BCC5. resumo da semana junta treinos e variação de peso', () => {
  const { resumirSemana } = require('../../netlify/functions/body-coach-chat.js');
  const dia = 86400000, agora = Date.now(), iso = (d) => new Date(agora - d * dia).toISOString();
  const r = resumirSemana({
    treinos: [{ done_at: iso(1), title: 'A', duration_min: 50, volume_kg: 4000 }, { done_at: iso(3), title: 'B', duration_min: 40, volume_kg: 3000 }, { done_at: iso(12), title: 'Velho', duration_min: 60, volume_kg: 9999 }],
    pesos: [{ taken_at: iso(2), weight_kg: 79.5 }, { taken_at: iso(9), weight_kg: 80 }],
  }, agora - 7 * dia, { nome: 'Ana' });
  assert.equal(r.treinos, 2); assert.equal(r.minutos, 90); assert.equal(r.volumeKg, 7000);
  assert.equal(r.pesoAtual, 79.5); assert.equal(r.variacaoPeso, -0.5); assert.equal(r.aluno, 'Ana');
});

test('BCC6. aluno sem coach pode virar coach; aluno com coach não; alunos não veem uns aos outros', async () => {
  const db = fakeDb();
  const [, c1] = await executar({ acao: 'perfil', papel: 'coach', nome: 'Gil' }, 'coach1', db);
  await executar({ acao: 'perfil', papel: 'aluno', nome: 'Ana' }, 'ana', db);
  await executar({ acao: 'perfil', papel: 'aluno', nome: 'Bob' }, 'bob', db);
  await executar({ acao: 'vincular', codigo: c1.perfil.codigo }, 'ana', db);
  await executar({ acao: 'vincular', codigo: c1.perfil.codigo }, 'bob', db);
  const [, lista] = await executar({ acao: 'contatos' }, 'coach1', db);
  assert.equal(lista.contatos.length, 2);
  assert.deepEqual((await executar({ acao: 'contatos' }, 'ana', db))[1].contatos.map((x) => x.uid), ['coach1']);
  assert.equal((await executar({ acao: 'ler', com: 'bob' }, 'ana', db))[0], 403);
  assert.equal((await executar({ acao: 'resumo', com: 'bob' }, 'ana', db))[0], 403);
  assert.equal((await executar({ acao: 'perfil', papel: 'coach', nome: 'Ana' }, 'ana', db))[1].perfil.papel, 'aluno');
  await executar({ acao: 'perfil', papel: 'aluno', nome: 'Cris' }, 'cris', db);
  const [, v] = await executar({ acao: 'perfil', papel: 'coach', nome: 'Cris' }, 'cris', db);
  assert.equal(v.perfil.papel, 'coach'); assert.match(v.perfil.codigo, /^[A-Z2-9]{6}$/);
});

test('BCC7. ler só o que chegou depois; feedback entra para todos e só o master lê', async () => {
  const db = fakeDb();
  const [, c] = await executar({ acao: 'perfil', papel: 'coach', nome: 'Gil' }, 'coach1', db);
  await executar({ acao: 'perfil', papel: 'aluno', nome: 'Ana' }, 'ana', db);
  await executar({ acao: 'vincular', codigo: c.perfil.codigo }, 'ana', db);
  const [, m1] = await executar({ acao: 'enviar', com: 'coach1', texto: 'um' }, 'ana', db);
  await new Promise((r) => setTimeout(r, 3));
  await executar({ acao: 'enviar', com: 'ana', texto: 'dois' }, 'coach1', db);
  const [, novos] = await executar({ acao: 'ler', com: 'ana', depois: m1.mensagem.em }, 'coach1', db);
  assert.deepEqual(novos.mensagens.map((m) => m.texto), ['dois']);
  assert.equal((await executar({ acao: 'feedback_enviar', texto: 'oi' }, 'ana', db))[0], 400);
  assert.equal((await executar({ acao: 'feedback_enviar', texto: 'o botão não abre', tipo: 'bug' }, 'ana', db))[0], 200);
  assert.equal((await executar({ acao: 'feedback_ver' }, 'ana', db, { master: false }))[0], 403);
  assert.equal((await executar({ acao: 'feedback_ver' }, 'ana', db, { master: true }))[1].itens.length, 1);
});
