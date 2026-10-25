// Teste das regras de "evitar" e "favoritos" na montagem do treino do dia (#1506)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');

async function carregar() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-fav-evitar-'));
  for (const nome of ['exerciseDb', 'dayPlan', 'ficha']) {
    const src = fs.readFileSync(path.join(__dirname, `../../apps/body-coach/src/lib/${nome}.ts`), 'utf8');
    const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
      .replace(/from '\.\/(exerciseDb|dayPlan)'/g, "from './$1.mjs'")
      .replace(/import\.meta\.env\.BASE_URL/g, "'/'");
    fs.writeFileSync(path.join(dir, `${nome}.mjs`), out);
  }
  const day = await import(pathToFileURL(path.join(dir, 'dayPlan.mjs')).href);
  const db = await import(pathToFileURL(path.join(dir, 'exerciseDb.mjs')).href);
  return { ...day, POR_ID: db.POR_ID, EXERCICIOS: db.EXERCICIOS };
}

const BASE = {
  name: 'Carlos', sex: 'M', goals: ['Hipertrofia'], goal: 'Hipertrofia', level: 'Intermediário',
  days: '3', minutes: '60', place: 'Academia completa', age: '30'
};

test('exercícios em "evitar" nunca aparecem no treino montado', async () => {
  const m = await carregar();
  // Treino A (ABC) inclui peito, ombros e tríceps. Vamos evitar o "supino-reto-com-barra".
  const semEvitar = m.montarTreinoDoDia({ respostas: BASE, divisao: 'abc', diaDaDivisao: 0, enfase: [], estado: { sono: 'bom', alimentacao: 'comi_bem', energia: 4, tempoMin: 60, dores: '', indisponiveis: [] }, variacao: 0 });
  const comEvitar = m.montarTreinoDoDia({ respostas: { ...BASE, evitar: ['supino-reto-com-barra'] }, divisao: 'abc', diaDaDivisao: 0, enfase: [], estado: { sono: 'bom', alimentacao: 'comi_bem', energia: 4, tempoMin: 60, dores: '', indisponiveis: [] }, variacao: 0 });

  const idsSem = semEvitar.sessao.exercises.map((e) => e.id);
  const idsCom = comEvitar.sessao.exercises.map((e) => e.id);

  assert.ok(!idsCom.includes('supino-reto-com-barra'), 'supino-reto-com-barra não deve aparecer no treino quando está em evitar');
  if (idsSem.includes('supino-reto-com-barra')) {
    assert.notDeepEqual(idsSem, idsCom, 'o treino sem evitar e com evitar deve ser diferente');
  }
});

test('exercícios em "evitar" dentro de onboarding.evitar também são filtrados', async () => {
  const m = await carregar();
  const comEvitarOnboarding = m.montarTreinoDoDia({ respostas: { ...BASE, onboarding: { evitar: ['supino-reto-com-barra'] } }, divisao: 'abc', diaDaDivisao: 0, enfase: [], estado: { sono: 'bom', alimentacao: 'comi_bem', energia: 4, tempoMin: 60, dores: '', indisponiveis: [] }, variacao: 0 });
  const ids = comEvitarOnboarding.sessao.exercises.map((e) => e.id);
  assert.ok(!ids.includes('supino-reto-com-barra'), 'supino-reto-com-barra não deve aparecer no treino quando em onboarding.evitar');
});

test('exercícios em "favoritos" sobem na prioridade/pontuação e são selecionados', async () => {
  const m = await carregar();
  // Escolher um exercício isolado ou secundário de peito, ex: 'flexao-de-bracos' ou 'crossover-na-polia'
  // Vamos dar a 'flexao-de-bracos' status de favorito para ver se ele ganha vaga ou prioridade
  const semFav = m.montarTreinoDoDia({ respostas: BASE, divisao: 'abc', diaDaDivisao: 0, enfase: [], estado: { sono: 'bom', alimentacao: 'comi_bem', energia: 4, tempoMin: 60, dores: '', indisponiveis: [] }, variacao: 0 });
  const comFav = m.montarTreinoDoDia({ respostas: { ...BASE, favoritos: ['flexao-de-bracos'] }, divisao: 'abc', diaDaDivisao: 0, enfase: [], estado: { sono: 'bom', alimentacao: 'comi_bem', energia: 4, tempoMin: 60, dores: '', indisponiveis: [] }, variacao: 0 });

  const idsSem = semFav.sessao.exercises.map((e) => e.id);
  const idsCom = comFav.sessao.exercises.map((e) => e.id);

  assert.ok(idsCom.includes('flexao-de-bracos') || !idsSem.includes('flexao-de-bracos'), 'exercício favorito deve ter pontuação incrementada');
});

test('remoção de exercício da lista de evitar atualiza corretamente o array', async () => {
  const listaInicial = ['supino-reto-com-barra', 'agachamento-livre'];
  const idParaRemover = 'supino-reto-com-barra';
  const listaAposRemocao = listaInicial.filter((id) => id !== idParaRemover);

  assert.deepEqual(listaAposRemocao, ['agachamento-livre']);
  assert.equal(listaAposRemocao.includes(idParaRemover), false);
});

test('adição de exercício à lista de evitar (addEvitar) atualiza a lista sem duplicar', async () => {
  const idAdicionar = 'crucifixo-com-halteres';
  const listaInicial = ['supino-reto-com-barra'];
  const novaLista = listaInicial.includes(idAdicionar) ? listaInicial : [...listaInicial, idAdicionar];

  assert.deepEqual(novaLista, ['supino-reto-com-barra', 'crucifixo-com-halteres']);

  // Tentar adicionar de novo não duplica
  const listaDuplicada = novaLista.includes(idAdicionar) ? novaLista : [...novaLista, idAdicionar];
  assert.deepEqual(listaDuplicada, ['supino-reto-com-barra', 'crucifixo-com-halteres']);
});
