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

test('BCC8. desafio: coach cria, aluno marca o dia, só o coach vê todos', async () => {
  const db = fakeDb();
  await executar({ acao: 'perfil', papel: 'coach', nome: 'Gil' }, 'coach1', db);
  const [, c] = await executar({ acao: 'perfil', papel: 'coach', nome: 'Gil' }, 'coach1', db);
  await executar({ acao: 'perfil', papel: 'aluno', nome: 'Ana' }, 'aluna1', db);
  await executar({ acao: 'perfil', papel: 'aluno', nome: 'Bob' }, 'bob', db);
  await executar({ acao: 'vincular', codigo: c.perfil.codigo }, 'aluna1', db);
  assert.equal((await executar({ acao: 'desafio_criar', titulo: '7 dias', dias: 7 }, 'aluna1', db))[0], 403);
  assert.equal((await executar({ acao: 'desafio_criar', titulo: 'x', dias: 7 }, 'coach1', db))[0], 400);
  assert.equal((await executar({ acao: 'desafio_criar', titulo: '7 dias treinando', dias: 1 }, 'coach1', db))[0], 400);
  assert.equal((await executar({ acao: 'desafio_checkin' }, 'aluna1', db))[0], 404);
  assert.equal((await executar({ acao: 'desafio_criar', titulo: '7 dias treinando', dias: 7 }, 'coach1', db))[0], 200);
  const [, v0] = await executar({ acao: 'desafio_ver' }, 'aluna1', db);
  assert.equal(v0.desafio.titulo, '7 dias treinando');
  assert.deepEqual(v0.datas, []);
  const [s1, m1] = await executar({ acao: 'desafio_checkin' }, 'aluna1', db);
  assert.equal(s1, 200);
  const [, m2] = await executar({ acao: 'desafio_checkin' }, 'aluna1', db);
  assert.equal(m2.datas.length, 1, 'marcar duas vezes no mesmo dia conta uma só');
  assert.deepEqual(m1.datas, m2.datas);
  assert.equal((await executar({ acao: 'desafio_checkin' }, 'bob', db))[0], 403, 'aluno sem coach não marca');
  const [, cv] = await executar({ acao: 'desafio_ver' }, 'coach1', db);
  assert.equal(cv.alunos.length, 1);
  assert.equal(cv.alunos[0].feitos, 1);
  const [, bv] = await executar({ acao: 'desafio_ver' }, 'bob', db);
  assert.equal(bv.desafio, null, 'aluno de ninguém não vê desafio');
});

test('BCC9. evolução: coach vê avaliações do aluno; fotos só se o aluno ligar; outro coach não vê', async () => {
  const db = fakeDb();
  const [, c] = await executar({ acao: 'perfil', papel: 'coach', nome: 'Gil' }, 'coach1', db);
  await executar({ acao: 'perfil', papel: 'coach', nome: 'Outro' }, 'coach2', db);
  await executar({ acao: 'perfil', papel: 'aluno', nome: 'Ana' }, 'ana', db);
  await executar({ acao: 'vincular', codigo: c.perfil.codigo }, 'ana', db);
  const base = db.collection('bodycoach_users').doc('ana');
  await base.collection('profile').doc('main').set({ sexo: 'F', height_cm: 165, onboarding: { age: '30' } });
  await base.collection('progress_entries').doc('1').set({ id: 1, taken_at: '2026-09-01T12:00:00Z', weight_kg: 62, avaliacao: { data: '2026-09-01', valores: { peso: 62 } }, fotos: { frente: 'data:image/jpeg;base64,AAA' } });
  await base.collection('progress_entries').doc('2').set({ id: 2, taken_at: '2026-10-01T12:00:00Z', weight_kg: 61, avaliacao: { data: '2026-10-01', valores: { peso: 61 } }, fotos: {} });
  const [s, r] = await executar({ acao: 'aluno_evolucao', com: 'ana' }, 'coach1', db);
  assert.equal(s, 200);
  assert.deepEqual(r.entradas.map((e) => e.id), [2, 1]);
  assert.equal(r.entradas[1].fotos, null, 'sem permissão do aluno a foto não sai do servidor');
  assert.deepEqual(r.entradas[1].poses, ['frente']);
  assert.equal(r.perfil.sexo, 'F'); assert.equal(r.perfil.idade, 30);
  assert.equal((await executar({ acao: 'aluno_evolucao', com: 'ana' }, 'coach2', db))[0], 403);
  assert.equal((await executar({ acao: 'aluno_evolucao', com: 'coach1' }, 'ana', db))[0], 403);
  await executar({ acao: 'evolucao_config', avaliacoes: true, fotos: true }, 'ana', db);
  const [, r2] = await executar({ acao: 'aluno_evolucao', com: 'ana' }, 'coach1', db);
  assert.equal(r2.entradas[1].fotos.frente, 'data:image/jpeg;base64,AAA');
  await executar({ acao: 'evolucao_config', avaliacoes: false, fotos: false }, 'ana', db);
  assert.equal((await executar({ acao: 'aluno_evolucao', com: 'ana' }, 'coach1', db))[0], 403);
  const [, painel] = await executar({ acao: 'alunos_evolucao' }, 'coach1', db);
  assert.equal(painel.alunos[0].entradas.length, 0);
  assert.equal((await executar({ acao: 'evolucao_info' }, 'semperfil', db))[1].coach, null);
});

test('BCC10. coach marca avaliação e comenta; aluno vê na conversa e na agenda', async () => {
  const db = fakeDb();
  const [, c] = await executar({ acao: 'perfil', papel: 'coach', nome: 'Gil' }, 'coach1', db);
  await executar({ acao: 'perfil', papel: 'aluno', nome: 'Ana' }, 'ana', db);
  await executar({ acao: 'vincular', codigo: c.perfil.codigo }, 'ana', db);
  assert.equal((await executar({ acao: 'agendar_avaliacao', com: 'ana', data: '2020-01-01' }, 'coach1', db))[0], 400);
  assert.equal((await executar({ acao: 'agendar_avaliacao', com: 'coach1', data: '2099-01-01' }, 'ana', db))[0], 403);
  const [s] = await executar({ acao: 'agendar_avaliacao', com: 'ana', data: '2099-01-02', hora: '07:30' }, 'coach1', db);
  assert.equal(s, 200);
  const [, info] = await executar({ acao: 'evolucao_info' }, 'ana', db);
  assert.equal(info.coach.nome, 'Gil');
  assert.deepEqual([info.proximaAvaliacao.data, info.proximaAvaliacao.hora], ['2099-01-02', '07:30']);
  assert.equal(info.partilha.avaliacoes, true); assert.equal(info.partilha.fotos, false);
  await new Promise((r) => setTimeout(r, 3));
  assert.equal((await executar({ acao: 'comentar', com: 'ana', entrada: '../x', texto: 'oi' }, 'coach1', db))[0], 400);
  await executar({ acao: 'comentar', com: 'ana', entrada: '2', alvo: 'frente', texto: 'Ombros mais largos!', data: '2026-10-01' }, 'coach1', db);
  const [, l] = await executar({ acao: 'ler', com: 'coach1' }, 'ana', db);
  assert.match(l.mensagens[0].texto, /02\/01\/2099 às 07:30/);
  assert.deepEqual(l.mensagens[1].ref, { entrada: '2', alvo: 'frente', data: '2026-10-01' });
});

test('BCC11. link público da avaliação: abre sem login, esconde fotos se pedido, vence e pode ser revogado', async () => {
  const { verCompartilhado } = require('../../netlify/functions/body-coach-chat.js');
  const db = fakeDb();
  const base = db.collection('bodycoach_users').doc('ana');
  await base.collection('progress_entries').doc('1').set({ id: 1, taken_at: '2026-09-01T12:00:00Z', avaliacao: { data: '2026-09-01', valores: { peso: 62 } }, fotos: { frente: 'data:x' } });
  await base.collection('progress_entries').doc('2').set({ id: 2, taken_at: '2026-10-01T12:00:00Z', avaliacao: { data: '2026-10-01', valores: { peso: 61 } }, fotos: { frente: 'data:y' } });
  assert.equal((await executar({ acao: 'compartilhar_criar', entrada: '9' }, 'ana', db))[0], 404);
  assert.equal((await executar({ acao: 'compartilhar_criar', entrada: '2' }, 'bob', db))[0], 404, 'só o dono compartilha');
  const [, a] = await executar({ acao: 'compartilhar_criar', entrada: '2', dias: 7 }, 'ana', db);
  assert.match(a.token, /^[a-f0-9]{36}$/);
  const [s, v] = await verCompartilhado({ token: a.token }, db);
  assert.equal(s, 200);
  assert.deepEqual(v.entradas.map((e) => e.id), [2, 1], 'leva a anterior para a comparação');
  assert.equal(v.entradas[0].fotos, null);
  const [, b] = await executar({ acao: 'compartilhar_criar', entrada: '2', fotos: true }, 'ana', db);
  assert.equal((await verCompartilhado({ token: b.token }, db))[1].entradas[0].fotos.frente, 'data:y');
  assert.equal((await executar({ acao: 'compartilhar_revogar', token: b.token }, 'bob', db))[0], 404);
  await executar({ acao: 'compartilhar_revogar', token: b.token }, 'ana', db);
  assert.equal((await verCompartilhado({ token: b.token }, db))[0], 404);
  await db.collection('bc_compartilhados').doc(a.token).set({ expira: Date.now() - 1 }, { merge: true });
  assert.equal((await verCompartilhado({ token: a.token }, db))[0], 410);
  assert.equal((await verCompartilhado({ token: 'curto' }, db))[0], 404);
  const r = await handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ acao: 'compartilhado_ver', token: 'x'.repeat(30) }) });
  assert.notEqual(r.statusCode, 401, 'o link público não pede login');
});
