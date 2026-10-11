'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { executar } = require('../../netlify/functions/body-coach-chat.js');

// banco de mentira em memória (só o que a função usa)
function fakeDb() {
  const dados = {};
  let n = 0;
  const lista = (path) => Object.entries(dados[path] || {}).map(([id, d]) => ({ id, data: () => d }));
  const col = (path) => ({
    doc: (id) => ({
      get: async () => ({ id, exists: !!(dados[path] || {})[id], data: () => (dados[path] || {})[id] }),
      set: async (v, o) => { (dados[path] ||= {})[id] = o && o.merge ? { ...((dados[path] || {})[id] || {}), ...v } : v; },
      collection: (sub) => col(`${path}/${id}/${sub}`),
    }),
    add: async (v) => { const id = `m${++n}`; (dados[path] ||= {})[id] = v; return { id }; },
    where: (campo, op, val) => ({ limit: () => ({ get: async () => ({ docs: lista(path).filter((d) => d.data()[campo] === val) }) }) }),
    orderBy: (campo) => ({ limit: (k) => ({ get: async () => ({ docs: lista(path).sort((a, b) => String(b.data()[campo]).localeCompare(String(a.data()[campo]))).slice(0, k) }) }) }),
  });
  return { collection: col, dados };
}

async function equipe() {
  const db = fakeDb();
  const [, c] = await executar({ acao: 'perfil', papel: 'coach', nome: 'Gil' }, 'coach1', db);
  await executar({ acao: 'perfil', papel: 'aluno', nome: 'Ana' }, 'ana', db);
  await executar({ acao: 'perfil', papel: 'aluno', nome: 'Bob' }, 'bob', db);
  await executar({ acao: 'vincular', codigo: c.perfil.codigo }, 'ana', db);
  await db.collection('bodycoach_users').doc('ana').collection('profile').doc('main').set({ onboarding: { level: 'Iniciante', days: 3 }, mobility: ['Gestante'] });
  return db;
}

const FICHA = { nome: 'Hipertrofia', dias: [{ titulo: 'A · Peito', exercicios: [{ id: 'supino_reto', nome: 'Supino reto', grupo: 'peito', series: 4, reps: '8–10', descanso: 120, carga: '30 kg', obs: 'Controle a descida' }, { nome: '' }] }, { titulo: 'vazio', exercicios: [] }] };

test('BCP1. coach monta a ficha: vai para o perfil do aluno e avisa na conversa', async () => {
  const db = await equipe();
  const [st, r] = await executar({ acao: 'prescricao_ver', com: 'ana' }, 'coach1', db);
  assert.equal(st, 200);
  assert.equal(r.respostas.level, 'Iniciante');
  assert.deepEqual(r.respostas.mobility, ['Gestante']);
  assert.equal(r.ficha, null);
  const [s2, r2] = await executar({ acao: 'ficha_salvar', com: 'ana', ficha: FICHA }, 'coach1', db);
  assert.equal(s2, 200);
  assert.match(r2.mensagem.texto, /Hipertrofia/);
  const p = db.dados['bodycoach_users/ana/profile'].main;
  assert.equal(p.ficha_coach.dias.length, 1, 'dia sem exercício sai');
  assert.equal(p.ficha_coach.dias[0].exercicios.length, 1, 'exercício sem nome sai');
  assert.equal(p.ficha_coach.dias[0].exercicios[0].series, 4);
  assert.equal(p.ficha_coach.coach, 'Gil');
  assert.equal(p.ficha_coach_dia, 0);
  assert.equal(p.onboarding.level, 'Iniciante', 'não apaga o resto do perfil');
  const [, r3] = await executar({ acao: 'prescricao_ver', com: 'ana' }, 'coach1', db);
  assert.equal(r3.ficha.nome, 'Hipertrofia');
  assert.equal((await executar({ acao: 'ficha_salvar', com: 'ana', ficha: { dias: [] } }, 'coach1', db))[0], 400);
  await executar({ acao: 'ficha_salvar', com: 'ana', remover: true }, 'coach1', db);
  assert.equal(db.dados['bodycoach_users/ana/profile'].main.ficha_coach, null);
});

test('BCP2. só o coach do aluno monta ficha e dieta', async () => {
  const db = await equipe();
  assert.equal((await executar({ acao: 'ficha_salvar', com: 'bob', ficha: FICHA }, 'coach1', db))[0], 403);
  assert.equal((await executar({ acao: 'ficha_salvar', com: 'coach1', ficha: FICHA }, 'ana', db))[0], 403);
  assert.equal((await executar({ acao: 'prescricao_ver', com: 'ana' }, 'bob', db))[0], 403);
  assert.equal((await executar({ acao: 'alunos_painel' }, 'ana', db))[0], 403);
});

test('BCP3. dieta do coach no formato do plano da nutricionista', async () => {
  const db = await equipe();
  const plano = { totais: { kcal: 2000, proteina: 150 }, refeicoes: [{ horario: '7:30', nome: 'Café', itens: [{ nome: 'Ovos', qtd: '3 un' }, { nome: '' }], trocas: [{ de: 'Ovos', por: ['Iogurte 170 g'] }] }, { nome: 'Vazia', itens: [] }] };
  const [st] = await executar({ acao: 'dieta_salvar', com: 'ana', plano }, 'coach1', db);
  assert.equal(st, 200);
  const p = db.dados['bodycoach_users/ana/profile'].main.plano_nutri;
  assert.equal(p.refeicoes.length, 1);
  assert.equal(p.refeicoes[0].horario, '07:30');
  assert.equal(p.refeicoes[0].itens.length, 1);
  assert.equal(p.totais.kcal, 2000);
  assert.equal(p.arquivo, 'Plano de Gil');
  assert.equal(p.do_coach, true);
  assert.equal((await executar({ acao: 'dieta_salvar', com: 'ana', plano: { refeicoes: [] } }, 'coach1', db))[0], 400);
});

test('BCP4. painel do coach: treinou hoje, dias sem treinar, refeições e pagamento', async () => {
  const db = await equipe();
  const [, c] = await executar({ acao: 'contatos' }, 'coach1', db);
  await executar({ acao: 'vincular', codigo: c.codigo }, 'bob', db);
  let [st, r] = await executar({ acao: 'alunos_painel' }, 'coach1', db);
  assert.equal(st, 200);
  const ana0 = r.alunos.find((a) => a.uid === 'ana');
  assert.equal(ana0.treinouHoje, false);
  assert.equal(ana0.diasSemTreinar, null);
  // Bob treinou há 4 dias (registro antigo, antes do campo ultimoTreino existir)
  await db.collection('bodycoach_users').doc('bob').collection('workouts').doc('w1').set({ done_at: new Date(Date.now() - 4 * 86400000).toISOString() });
  await executar({ acao: 'treino_feito', minutos: 50, kcal: 300 }, 'ana', db);
  await db.collection('bodycoach_users').doc('ana').collection('meals').doc('x').set({ created_at: new Date().toISOString() });
  await executar({ acao: 'pagamento_avisar' }, 'ana', db);
  [, r] = await executar({ acao: 'alunos_painel' }, 'coach1', db);
  const ana = r.alunos.find((a) => a.uid === 'ana');
  const bob = r.alunos.find((a) => a.uid === 'bob');
  assert.equal(ana.treinouHoje, true);
  assert.equal(ana.diasSemTreinar, 0);
  assert.equal(ana.treinosSemana, 1);
  assert.equal(ana.refeicoesHoje, 1);
  assert.equal(ana.avisou, true);
  assert.equal(ana.pago, false);
  assert.equal(bob.treinouHoje, false);
  assert.ok(bob.diasSemTreinar >= 3 && bob.diasSemTreinar <= 5, String(bob.diasSemTreinar));
});

test('BCP5. treino salvo sem internet conta no dia em que foi feito', async () => {
  const db = await equipe();
  const ontem = Date.now() - 86400000;
  await executar({ acao: 'treino_feito', minutos: 40, feitoEm: ontem }, 'ana', db);
  assert.equal(db.dados.bc_diretorio.ana.ultimoTreino, ontem);
  await executar({ acao: 'treino_feito', minutos: 40, feitoEm: Date.now() + 99999999 }, 'ana', db);
  assert.ok(db.dados.bc_diretorio.ana.ultimoTreino <= Date.now());
});
