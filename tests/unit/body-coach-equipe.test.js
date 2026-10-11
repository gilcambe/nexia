'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { executar } = require('../../netlify/functions/body-coach-chat.js');
const { textoDoTreino } = require('../../netlify/functions/body-coach/equipe.js');

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
    orderBy: (campo) => ({ limit: (k) => ({ get: async () => ({ docs: lista(path).sort((a, b) => String(b.data()[campo]).localeCompare(String(a.data()[campo]))).slice(0, k) }) }) }),
  });
  return { collection: col, dados };
}
const msgs = (db, a, b) => Object.values(db.dados[`bc_conversas/${[a, b].sort().join('__')}/mensagens`] || {});

async function montar() {
  const db = fakeDb();
  const [, c] = await executar({ acao: 'perfil', papel: 'coach', nome: 'Gil' }, 'coach1', db);
  await executar({ acao: 'perfil', papel: 'coach', nome: 'Outro' }, 'coach2', db);
  for (const [id, nome] of [['ana', 'Ana'], ['bob', 'Bob'], ['eva', 'Eva']]) await executar({ acao: 'perfil', papel: 'aluno', nome }, id, db);
  await executar({ acao: 'vincular', codigo: c.perfil.codigo }, 'ana', db);
  await executar({ acao: 'vincular', codigo: c.perfil.codigo }, 'bob', db);
  return db;
}

const PERGUNTAS = [
  { texto: 'Tem algum problema de coração?', tipo: 'simnao', obrigatoria: true },
  { texto: 'Qual o seu objetivo?', tipo: 'opcoes', opcoes: ['Emagrecer', 'Ganhar massa'] },
  { texto: 'Toma algum remédio?', tipo: 'texto' },
  { texto: 'oi', tipo: 'texto' },
  { texto: 'Opções sem opções', tipo: 'opcoes', opcoes: ['só uma'] },
];

test('BCE1. anamnese: coach cria, aluno vê pendente, responde (obrigatória confere), coach vê respostas', async () => {
  const db = await montar();
  assert.equal((await executar({ acao: 'anamnese_salvar', perguntas: PERGUNTAS }, 'ana', db))[0], 403);
  const [s, r] = await executar({ acao: 'anamnese_salvar', perguntas: PERGUNTAS, titulo: 'Ficha de entrada' }, 'coach1', db);
  assert.equal(s, 200);
  assert.equal(r.anamnese.perguntas.length, 4, 'pergunta curta demais sai');
  assert.equal(r.anamnese.perguntas[3].tipo, 'texto', 'opções com menos de 2 vira texto');
  const ids = r.anamnese.perguntas.map((p) => p.id);
  const [, v] = await executar({ acao: 'anamnese_ver' }, 'ana', db);
  assert.equal(v.situacao, 'pendente');
  assert.equal(v.coach, 'Gil');
  const [, painel] = await executar({ acao: 'alunos_painel' }, 'coach1', db);
  assert.ok(painel.alunos.every((a) => a.anamnese === 'pendente'));
  const [e1, er] = await executar({ acao: 'anamnese_responder', respostas: { [ids[2]]: 'Nenhum' } }, 'ana', db);
  assert.equal(e1, 400);
  assert.match(er.error, /coração/);
  const [s2] = await executar({ acao: 'anamnese_responder', respostas: { [ids[0]]: 'nao', [ids[1]]: 'Voar', [ids[2]]: 'Nenhum' } }, 'ana', db);
  assert.equal(s2, 200);
  const [, v2] = await executar({ acao: 'anamnese_ver' }, 'ana', db);
  assert.equal(v2.situacao, 'respondida');
  assert.equal(v2.respostas[ids[1]], undefined, 'opção que não existe é descartada');
  assert.match(msgs(db, 'ana', 'coach1').at(-1).texto, /Respondi a sua anamnese/);
  const [, p] = await executar({ acao: 'prescricao_ver', com: 'ana' }, 'coach1', db);
  assert.equal(p.anamnese.situacao, 'respondida');
  assert.equal(p.anamnese.respostas[ids[0]], 'nao');
  // coach muda a anamnese: volta a ficar pendente
  await executar({ acao: 'anamnese_salvar', perguntas: PERGUNTAS.slice(0, 2) }, 'coach1', db);
  assert.equal((await executar({ acao: 'anamnese_ver' }, 'ana', db))[1].situacao, 'pendente');
  // aluno sem coach
  assert.equal((await executar({ acao: 'anamnese_responder', respostas: {} }, 'eva', db))[0], 403);
  assert.equal((await executar({ acao: 'anamnese_ver' }, 'eva', db))[1].anamnese, null);
});

const FICHA = { nome: 'Iniciante ABC', dias: [{ titulo: 'A', exercicios: [{ id: 'supino_reto', nome: 'Supino reto', grupo: 'peito', series: 3, reps: '10', descanso: 90 }] }] };
const DIETA = { refeicoes: [{ nome: 'Café', horario: '07:00', itens: [{ nome: 'Ovos', qtd: '2' }] }], totais: { kcal: 1800 } };

test('BCE2. modelos: salvar, listar, aplicar a vários alunos (só os da equipe), apagar', async () => {
  const db = await montar();
  assert.equal((await executar({ acao: 'modelo_salvar', tipo: 'ficha', dados: FICHA }, 'ana', db))[0], 403);
  assert.equal((await executar({ acao: 'modelo_salvar', tipo: 'ficha', dados: { dias: [] } }, 'coach1', db))[0], 400);
  const [, f] = await executar({ acao: 'modelo_salvar', tipo: 'ficha', dados: FICHA, nome: 'Iniciantes' }, 'coach1', db);
  const [, d] = await executar({ acao: 'modelo_salvar', tipo: 'dieta', dados: DIETA, nome: 'Cutting 1800' }, 'coach1', db);
  const [, l] = await executar({ acao: 'modelo_listar' }, 'coach1', db);
  assert.equal(l.modelos.length, 2);
  assert.equal(l.modelos.find((m) => m.id === f.id).resumo, '1 treino · 1 exercícios');
  assert.equal((await executar({ acao: 'modelo_listar', tipo: 'dieta' }, 'coach1', db))[1].modelos.length, 1);
  assert.equal((await executar({ acao: 'modelo_ver', id: f.id }, 'coach2', db))[0], 404, 'outro coach não vê');
  const [, ap] = await executar({ acao: 'modelo_aplicar', id: f.id, alunos: ['ana', 'bob', 'eva', 'ana'] }, 'coach1', db);
  assert.deepEqual(ap, { aplicados: 2, recusados: 1 });
  assert.equal(db.dados['bodycoach_users/bob/profile'].main.ficha_coach.nome, 'Iniciante ABC');
  assert.equal(db.dados['bodycoach_users/eva/profile'], undefined, 'aluno de fora não recebe');
  assert.match(msgs(db, 'bob', 'coach1').at(-1).texto, /Montei a sua ficha/);
  await executar({ acao: 'modelo_aplicar', id: d.id, alunos: ['ana'] }, 'coach1', db);
  const plano = db.dados['bodycoach_users/ana/profile'].main.plano_nutri;
  assert.equal(plano.do_coach, true);
  assert.equal(plano.arquivo, 'Plano de Gil');
  assert.equal((await executar({ acao: 'modelo_ver', id: f.id }, 'coach1', db))[1].modelo.dados.dias.length, 1);
  // editar mantém o id
  const [, e] = await executar({ acao: 'modelo_salvar', id: f.id, tipo: 'ficha', dados: FICHA, nome: 'Iniciantes v2' }, 'coach1', db);
  assert.equal(e.id, f.id);
  assert.equal((await executar({ acao: 'modelo_apagar', id: f.id }, 'coach2', db))[0], 404);
  await executar({ acao: 'modelo_apagar', id: f.id }, 'coach1', db);
  assert.equal((await executar({ acao: 'modelo_listar' }, 'coach1', db))[1].modelos.length, 1);
});

test('BCE3. treino com notas por série, falha e esforço vai para a conversa do coach', async () => {
  const db = await montar();
  const [, r0] = await executar({ acao: 'treino_feito', minutos: 40 }, 'ana', db);
  assert.equal(r0.coachAvisado, false, 'sem nota não manda nada');
  const [, r] = await executar({ acao: 'treino_feito', minutos: 45, titulo: 'Treino A', esforco: 4, comentario: 'Ombro incomodou no fim', notas: [{ ex: 'Supino reto', serie: 3, falha: true, carga: 30, reps: 8 }, { ex: 'Crucifixo', serie: 1, nota: 'senti o ombro' }, { ex: 'Remada', serie: 1 }] }, 'ana', db);
  assert.equal(r.coachAvisado, true);
  const m = msgs(db, 'ana', 'coach1').at(-1);
  assert.equal(m.tipo, 'treino');
  assert.match(m.texto, /Treino feito: Treino A \(45 min\)/);
  assert.match(m.texto, /Supino reto, série 3 \(30 kg × 8\) · até a falha/);
  assert.match(m.texto, /Crucifixo, série 1: senti o ombro/);
  assert.doesNotMatch(m.texto, /Remada/);
  assert.match(m.texto, /pesado/);
  // aluno sem coach: só conta o treino
  assert.equal((await executar({ acao: 'treino_feito', minutos: 10, comentario: 'oi' }, 'eva', db))[1].coachAvisado, false);
  assert.equal(textoDoTreino({ esforco: 9 }), '');
});
