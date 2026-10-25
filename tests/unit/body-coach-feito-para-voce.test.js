// A anamnese muda o treino de verdade (pedido do usuário em 24/10/2026: "qualquer que seja a resposta o treino será o mesmo").
// Sexo, objetivos (mais de um), nível, idade, onde treina, foco e rotina mudam divisão, exercícios, repetições e descanso.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');

async function carregar() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-voce-'));
  for (const nome of ['exerciseDb', 'dayPlan', 'ficha']) {
    const src = fs.readFileSync(path.join(__dirname, `../../apps/body-coach/src/lib/${nome}.ts`), 'utf8');
    const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
      .replace(/from '\.\/(exerciseDb|dayPlan)'/g, "from './$1.mjs'")
      .replace(/import\.meta\.env\.BASE_URL/g, "'/'");
    fs.writeFileSync(path.join(dir, `${nome}.mjs`), out);
  }
  const ficha = await import(pathToFileURL(path.join(dir, 'ficha.mjs')).href);
  const day = await import(pathToFileURL(path.join(dir, 'dayPlan.mjs')).href);
  const db = await import(pathToFileURL(path.join(dir, 'exerciseDb.mjs')).href);
  return { ...ficha, ...day, POR_ID: db.POR_ID };
}

const ANA = { name: 'Ana', sex: 'F', goals: ['Hipertrofia', 'Perda de gordura'], goal: 'Recomposição', level: 'Intermediário', days: '3', minutes: '60', place: 'Em casa com halteres', age: '29', lifestyle: 'Fico sentado quase o dia todo' };
const BRUNO = { name: 'Bruno', sex: 'M', goals: ['Força'], goal: 'Força', level: 'Avançado', days: '5', minutes: '75', place: 'Academia completa', age: '31' };
const JOSE = { name: 'José', sex: 'M', goals: ['Saúde'], goal: 'Saúde', level: 'Iniciante', days: '3', minutes: '45', place: 'Academia completa', age: '66' };

function treino(m, r) {
  const f = m.fichaDoPerfil({ onboarding: r });
  return { divisao: f.divisao, t: m.treinoDaFicha(r, f.divisao, 0) };
}

test('três pessoas diferentes recebem divisões, exercícios e doses diferentes', async () => {
  const m = await carregar();
  const a = treino(m, ANA); const b = treino(m, BRUNO); const j = treino(m, JOSE);
  assert.equal(a.divisao, 'inferior_enfase', 'mulher: foco em pernas e glúteos');
  assert.equal(b.divisao, 'ppl', 'avançado 5 dias');
  assert.equal(j.divisao, 'fullbody_ab', '60+ e saúde: corpo inteiro');
  const ids = (x) => x.t.sessao.exercises.map((e) => e.id).join(',');
  assert.notEqual(ids(a), ids(b)); assert.notEqual(ids(a), ids(j)); assert.notEqual(ids(b), ids(j));
  // Ana treina em casa com halteres: nada de máquina, cabo, barra ou smith.
  for (const e of a.t.sessao.exercises) assert.ok(['halter', 'corpo'].includes(m.POR_ID[e.id].equip), `${e.name} não dá para fazer em casa`);
  assert.ok(a.t.sessao.exercises.some((e) => m.POR_ID[e.id].grupo === 'gluteos'), 'mulher: glúteo no dia de pernas');
  // Doses: força 4–6 com descanso longo; recomposição 8–12 com descanso curto e cardio no fim.
  const comp = (x) => x.t.sessao.exercises.find((e) => m.POR_ID[e.id].composto);
  assert.equal(comp(b).targetReps, '4–6');
  assert.ok(comp(b).restSec >= 180);
  assert.equal(comp(a).targetReps, '8–12');
  assert.ok(comp(a).restSec <= 75);
  assert.ok(a.t.avisos.some((x) => /Para fechar/.test(x)), 'emagrecer: cardio intervalado no fim');
  assert.match(a.t.avisos[0], /Feito para você: mulher · hipertrofia \+ perda de gordura/);
  assert.ok(a.t.sessao.warmup.some((w) => /muito sentado/.test(w.name)), 'quem fica sentado ganha mobilidade de quadril');
  // José (66, iniciante): começa pelas máquinas e descansa mais.
  assert.ok(j.t.sessao.exercises.filter((e) => m.POR_ID[e.id].composto).every((e) => m.POR_ID[e.id].equip !== 'barra'), 'sem barra livre para iniciante 60+');
});

test('só peso do corpo: treino completo sem equipamento', async () => {
  const m = await carregar();
  const r = { ...BRUNO, place: 'Em casa sem equipamento', days: '3', level: 'Intermediário' };
  const f = m.fichaDoPerfil({ onboarding: r });
  for (let d = 0; d < m.DIVISOES[f.divisao].dias.length; d++) {
    const t = m.treinoDaFicha(r, f.divisao, d);
    assert.ok(t.sessao.exercises.length >= 3, `dia ${d} com exercícios`);
    for (const e of t.sessao.exercises) assert.equal(m.POR_ID[e.id].equip, 'corpo', e.name);
  }
});

test('mesma anamnese = mesmo treino em todas as telas; nome diferente = escolha diferente', async () => {
  const m = await carregar();
  assert.deepEqual(treino(m, ANA).t.sessao.exercises.map((e) => e.id), treino(m, ANA).t.sessao.exercises.map((e) => e.id));
  const nomes = ['Ana', 'Bia', 'Carla', 'Duda', 'Eva', 'Fabi', 'Gabi', 'Helô'];
  const r = (n) => ({ ...ANA, name: n, place: 'Academia completa' });
  const listas = new Set(nomes.map((n) => treino(m, r(n)).t.sessao.exercises.map((e) => e.id).join(',')));
  assert.ok(listas.size >= 3, `pessoas diferentes, treinos diferentes (${listas.size} de 8)`);
});

test('perfil antigo (só goal, sem sexo) continua funcionando', async () => {
  const m = await carregar();
  const t = treino(m, { level: 'Intermediário', goal: 'Hipertrofia', days: '4', minutes: '60' });
  assert.equal(t.divisao, 'upper_lower');
  assert.ok(t.t.sessao.exercises.length >= 4);
  assert.deepEqual(m.objetivosDe({ goal: 'Hipertrofia' }), ['Hipertrofia']);
  assert.equal(m.objetivoPrincipal(['Perda de gordura', 'Hipertrofia']), 'Recomposição');
});

test('ciclo menstrual: desligado não muda nada; ligado dá a fase do dia e mais reserva nos dias 1 a 3', async () => {
  const m = await carregar();
  const iso = (d) => d.toISOString().slice(0, 10);
  const ha = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
  assert.equal(m.faseDoCiclo({ ligado: false, inicio: ha(1) }), null);
  assert.deepEqual(m.faseDoCiclo({ ligado: true, inicio: ha(1), duracao: 28 }), { fase: 'menstrual', dia: 2 });
  assert.equal(m.faseDoCiclo({ ligado: true, inicio: ha(8), duracao: 28 }).fase, 'folicular');
  assert.equal(m.faseDoCiclo({ ligado: true, inicio: ha(13), duracao: 28 }).fase, 'ovulacao');
  assert.equal(m.faseDoCiclo({ ligado: true, inicio: ha(25), duracao: 28 }).fase, 'pre');
  const base = { ...ANA, place: 'Academia completa' };
  const sem = treino(m, base).t;
  const com = treino(m, { ...base, ciclo: { ligado: true, inicio: ha(0), duracao: 28 } }).t;
  assert.ok(!sem.avisos.some((a) => /ciclo/.test(a)));
  assert.ok(com.avisos.some((a) => /Dia 1 do ciclo/.test(a)));
  assert.equal(Number(/\d+/.exec(com.sessao.exercises[0].note)[0]), Number(/\d+/.exec(sem.sessao.exercises[0].note)[0]) + 1);
  // homem com o campo por engano: ignorado
  assert.ok(!treino(m, { ...BRUNO, ciclo: { ligado: true, inicio: ha(0) } }).t.avisos.some((a) => /ciclo/.test(a)));
});

test('exercícios evitados são excluídos e favoritos têm prioridade', async () => {
  const m = await carregar();
  const r = {
    ...ANA,
    evitar: ['agachamento-goblet'],
    favoritos: ['supino-reto-com-halteres'],
    place: 'Academia completa'
  };

  const entrada = {
    respostas: r,
    divisao: 'abc',
    diaDaDivisao: 0,
    enfase: [],
    estado: {
      sono: 'bom',
      alimentacao: 'comi_bem',
      energia: 4,
      tempoMin: 60,
      dores: '',
      indisponiveis: []
    },
    variacao: 0
  };

  const treino = m.montarTreinoDoDia(entrada);

  const ids = treino.sessao.exercises.map((e) => e.id);

  // Exercício evitado não aparece
  assert.ok(!ids.includes('agachamento-goblet'), 'Exercício evitado não deve aparecer no treino');

  // Exercício favorito aparece e tem prioridade (entre os primeiros)
  assert.ok(ids.includes('supino-reto-com-halteres'), 'Exercício favorito deve aparecer no treino');
  const idx = ids.indexOf('supino-reto-com-halteres');
  assert.ok(idx < 3, 'Exercício favorito deve ter prioridade (aparecer entre os primeiros)');
});

test('exercícios evitados são excluídos e favoritos têm prioridade com múltiplos itens', async () => {
  const m = await carregar();
  const r = {
    ...ANA,
    evitar: ['agachamento-goblet', 'supino-reto-com-halteres'],
    favoritos: ['rosca-alternada-com-halteres', 'desenvolvimento-militar-com-halteres'],
    place: 'Academia completa'
  };

  const entrada = {
    respostas: r,
    divisao: 'abc',
    diaDaDivisao: 0,
    enfase: [],
    estado: {
      sono: 'bom',
      alimentacao: 'comi_bem',
      energia: 4,
      tempoMin: 60,
      dores: '',
      indisponiveis: []
    },
    variacao: 0
  };

  const treino = m.montarTreinoDoDia(entrada);
  const ids = treino.sessao.exercises.map((e) => e.id);

  // Todos os exercícios evitados não devem aparecer
  assert.ok(!ids.includes('agachamento-goblet'), 'Exercício evitado 1 não deve aparecer no treino');
  assert.ok(!ids.includes('supino-reto-com-halteres'), 'Exercício evitado 2 não deve aparecer no treino');

  // Todos os favoritos devem aparecer
  assert.ok(ids.includes('rosca-alternada-com-halteres'), 'Exercício favorito 1 deve aparecer no treino');
  assert.ok(ids.includes('desenvolvimento-militar-com-halteres'), 'Exercício favorito 2 deve aparecer no treino');

  // Favoritos devem ter prioridade (aparecerem antes dos não favoritos)
  const idx1 = ids.indexOf('rosca-alternada-com-halteres');
  const idx2 = ids.indexOf('desenvolvimento-militar-com-halteres');
  assert.ok(idx1 < 4, 'Exercício favorito 1 deve ter prioridade (aparecer entre os primeiros)');
  assert.ok(idx2 < 4, 'Exercício favorito 2 deve ter prioridade (aparecer entre os primeiros)');

  // Verificar que os favoritos não estão nas últimas posições
  const lastThree = ids.slice(-3);
  assert.ok(!lastThree.includes('rosca-alternada-com-halteres'), 'Favorito 1 não deve estar nas últimas posições');
  assert.ok(!lastThree.includes('desenvolvimento-militar-com-halteres'), 'Favorito 2 não deve estar nas últimas posições');
});

test('exercicios evitados nao aparecem e favoritos sao promovidos', async () => {
  const m = await carregar();
  const r = {
    ...ANA,
    evitar: ['agachamento-goblet'],
    favoritos: ['supino-reto-com-halteres'],
    place: 'Academia completa'
  };

  const entrada = {
    respostas: r,
    divisao: 'abc',
    diaDaDivisao: 0,
    enfase: [],
    estado: {
      sono: 'bom',
      alimentacao: 'comi_bem',
      energia: 4,
      tempoMin: 60,
      dores: '',
      indisponiveis: []
    },
    variacao: 0
  };

  const treino = m.montarTreinoDoDia(entrada);
  const ids = treino.sessao.exercises.map((e) => e.id);

  // Exercício evitado não aparece na lista retornada
  assert.ok(!ids.includes('agachamento-goblet'), 'Exercício evitado não deve aparecer no treino');

  // Exercício favorito aparece e tem prioridade na ordenação (por causa do +1 ponto)
  assert.ok(ids.includes('supino-reto-com-halteres'), 'Exercício favorito deve aparecer no treino');
  const idx = ids.indexOf('supino-reto-com-halteres');
  assert.ok(idx < 3, 'Exercício favorito deve ter prioridade (aparecer entre os primeiros)');
});

test('teste de evitados e favoritos: evitados excluídos e favoritos promovidos', async () => {
  const m = await carregar();
  const r = {
    ...ANA,
    evitar: ['agachamento-goblet'],
    favoritos: ['supino-reto-com-halteres'],
    place: 'Academia completa'
  };

  const entrada = {
    respostas: r,
    divisao: 'abc',
    diaDaDivisao: 0,
    enfase: [],
    estado: {
      sono: 'bom',
      alimentacao: 'comi_bem',
      energia: 4,
      tempoMin: 60,
      dores: '',
      indisponiveis: []
    },
    variacao: 0
  };

  const treino = m.montarTreinoDoDia(entrada);
  const ids = treino.sessao.exercises.map((e) => e.id);

  // Exercício evitado não aparece na lista retornada
  assert.ok(!ids.includes('agachamento-goblet'), 'Exercício evitado não deve aparecer no treino');

  // Exercício favorito aparece e tem prioridade na ordenação (por causa do +1 ponto)
  assert.ok(ids.includes('supino-reto-com-halteres'), 'Exercício favorito deve aparecer no treino');
  const idx = ids.indexOf('supino-reto-com-halteres');
  assert.ok(idx < 3, 'Exercício favorito deve ter prioridade (aparecer entre os primeiros)');
});

test('em casa (com ou sem halteres) nunca aparece barra fixa, e as costas continuam treinadas', async () => {
  const m = await carregar();
  for (const place of ['Em casa com halteres', 'Em casa sem equipamento']) {
    for (const name of ['Ana', 'Bia', 'Carla', 'Duda', 'Eva', 'Gil', 'Hugo', 'Iara']) {
      const r = { ...ANA, name, place, days: '4' };
      const f = m.fichaDoPerfil({ onboarding: r });
      for (let i = 0; i < 4; i++) {
        const ids = m.treinoDaFicha(r, f.divisao, i).sessao.exercises.map((e) => e.id);
        assert.ok(!ids.includes('barra-fixa'), `${place} / ${name} / dia ${i}`);
      }
    }
  }
});

test('evitados são excluídos e favoritos promovidos na ordenação', async () => {
  const m = await carregar();
  const r = {
    ...ANA,
    evitar: ['agachamento-goblet'],
    favoritos: ['supino-reto-com-halteres'],
    place: 'Academia completa'
  };

  const entrada = {
    respostas: r,
    divisao: 'abc',
    diaDaDivisao: 0,
    enfase: [],
    estado: {
      sono: 'bom',
      alimentacao: 'comi_bem',
      energia: 4,
      tempoMin: 60,
      dores: '',
      indisponiveis: []
    },
    variacao: 0
  };

  const treino = m.montarTreinoDoDia(entrada);
  const ids = treino.sessao.exercises.map((e) => e.id);

  // Exercício evitado não aparece na lista retornada
  assert.ok(!ids.includes('agachamento-goblet'), 'Exercício evitado não deve aparecer no treino');

  // Exercício favorito aparece e tem prioridade na ordenação (por causa do +1 ponto)
  assert.ok(ids.includes('supino-reto-com-halteres'), 'Exercício favorito deve aparecer no treino');
  const idx = ids.indexOf('supino-reto-com-halteres');
  assert.ok(idx < 3, 'Exercício favorito deve ter prioridade (aparecer entre os primeiros)');
});

test('teste de evitados e favoritos: confirma exclusão e prioridade', async () => {
  const m = await carregar();
  const r = {
    ...ANA,
    evitar: ['agachamento-com-barra'],
    favoritos: ['rosca-direta-com-halter'],
    place: 'Academia completa'
  };

  const entrada = {
    respostas: r,
    divisao: 'abc',
    diaDaDivisao: 0,
    enfase: [],
    estado: {
      sono: 'bom',
      alimentacao: 'comi_bem',
      energia: 4,
      tempoMin: 60,
      dores: '',
      indisponiveis: []
    },
    variacao: 0
  };

  const treino = m.montarTreinoDoDia(entrada);
  const ids = treino.sessao.exercises.map((e) => e.id);

  // Exercício evitado não aparece na lista retornada
  assert.ok(!ids.includes('agachamento-com-barra'), 'Exercício evitado não deve aparecer no treino');

  // Exercício favorito aparece e tem prioridade na ordenação (por causa do +1 ponto)
  assert.ok(ids.includes('rosca-direta-com-halter'), 'Exercício favorito deve aparecer no treino');
  const idx = ids.indexOf('rosca-direta-com-halter');
  assert.ok(idx < 3, 'Exercício favorito deve ter prioridade (aparecer entre os primeiros)');
});
