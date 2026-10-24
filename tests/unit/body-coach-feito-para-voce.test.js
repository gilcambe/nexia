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
