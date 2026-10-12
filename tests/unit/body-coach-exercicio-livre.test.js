// Exercício que não está na lista (apps/body-coach/src/lib/exercicioLivre.ts): o aluno escreve o nome
// e ele entra no treino (no lugar do atual ou a mais); o que fez no intervalo vai para o coach.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');

async function carregar() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-livre-'));
  for (const nome of ['exerciseDb', 'dayPlan', 'ficha', 'coach/fichaCoach', 'exercicioLivre']) {
    const src = fs.readFileSync(path.join(__dirname, `../../apps/body-coach/src/lib/${nome}.ts`), 'utf8');
    const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
      .replace(/from '\.\.?\/(?:coach\/)?(exerciseDb|dayPlan|ficha|fichaCoach)'/g, "from './$1.mjs'")
      .replace(/import\.meta\.env\.BASE_URL/g, "'/'");
    fs.writeFileSync(path.join(dir, `${path.basename(nome)}.mjs`), out);
  }
  return import(pathToFileURL(path.join(dir, 'exercicioLivre.mjs')).href);
}

const ex = (id, name) => ({ id, name, muscleGroup: 'triceps', targetReps: '10-12', targetSets: 4, restSec: 60, note: '', minWeight: 0, maxWeight: 100, weightUnit: 'kg', prevSession: { date: '', sets: [] }, sets: [] });
const sessao = () => ({ id: 's', title: 'Braços', exercises: [ex('rosca-direta-com-barra', 'Rosca direta com barra'), ex('triceps-corda-na-polia', 'Tríceps corda na polia'), ex('prancha', 'Prancha')] });

test('troca o exercício atual por um escrito pelo aluno, herdando séries e reps', async () => {
  const { trocarPorLivre } = await carregar();
  const s = trocarPorLivre(sessao(), 1, '  Tríceps   coice ');
  assert.equal(s.exercises.length, 3);
  assert.equal(s.exercises[1].name, 'Tríceps coice');
  assert.equal(s.exercises[1].id, 'livre-triceps-coice');
  assert.equal(s.exercises[1].targetSets, 4);
  assert.equal(s.exercises[1].muscleGroup, 'triceps');
  assert.equal(s.exercises[2].id, 'prancha');
});

test('nome igual a um do banco usa o exercício do banco (com demonstração)', async () => {
  const { trocarPorLivre } = await carregar();
  const s = trocarPorLivre(sessao(), 1, 'triceps frances com halter');
  assert.equal(s.exercises[1].id, 'triceps-frances-com-halter');
  assert.equal(s.exercises[1].name, 'Tríceps francês com halter');
});

test('exercício a mais entra logo depois do atual, sem repetir id', async () => {
  const { adicionarDepois } = await carregar();
  const s = adicionarDepois(sessao(), 0, 'Prancha');
  assert.deepEqual(s.exercises.map((e) => e.id), ['rosca-direta-com-barra', 'prancha-2', 'triceps-corda-na-polia', 'prancha']);
  const vazia = sessao();
  assert.equal(adicionarDepois(vazia, 0, '   '), vazia);
});

test('sugestões incluem nomes comuns fora do banco e o intervalo vira nota para o coach', async () => {
  const { sugerirNomes, novoExtra, notaDoExtra } = await carregar();
  assert.ok(sugerirNomes('coice').includes('Tríceps coice com halter'));
  assert.deepEqual(sugerirNomes('a'), []);
  const x = novoExtra('Abdominal', '3x20', 'Supino reto com barra');
  assert.deepEqual({ ...notaDoExtra(x) }, { ex: 'Abdominal', serie: 1, falha: false, nota: 'no intervalo de Supino reto com barra: 3x20', carga: 0, reps: 0, extra: true });
  assert.equal(novoExtra('  ', '', 'x'), null);
});
