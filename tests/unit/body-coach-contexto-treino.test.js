// A IA do coach recebe a ficha e os últimos treinos em texto curto, sem quebrar com dado ruim.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');

async function carregar() {
  const src = fs.readFileSync(path.join(__dirname, '../../apps/body-coach/src/lib/coach/contextoTreino.ts'), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-treino-'));
  const arq = path.join(dir, 'contextoTreino.mjs');
  fs.writeFileSync(arq, js);
  return import(pathToFileURL(arq).href);
}

test('resumoFicha: nome, coach e exercícios com séries e reps', async () => {
  const { resumoFicha } = await carregar();
  const s = resumoFicha({ nome: 'Hipertrofia', coach: 'Ana', dias: [{ titulo: 'Treino A', exercicios: [{ nome: 'Supino', series: 4, reps: '8-10', carga: '30kg' }] }] });
  assert.match(s, /Hipertrofia \(Ana\)/);
  assert.match(s, /Treino A: Supino 4x8-10 30kg/);
});

test('resumoFicha: sem ficha ou ficha ruim devolve null, e corta texto longo', async () => {
  const { resumoFicha } = await carregar();
  assert.equal(resumoFicha(null), null);
  assert.equal(resumoFicha({ dias: [] }), null);
  assert.equal(resumoFicha('x'), null);
  const muitos = Array.from({ length: 7 }, (_, i) => ({ titulo: `T${i}`, exercicios: Array.from({ length: 15 }, (_, j) => ({ nome: `Exercicio comprido ${j}`, series: 3, reps: '10' })) }));
  assert.ok(resumoFicha({ nome: 'X', dias: muitos }).length <= 900);
});

test('resumoTreinos: os 5 mais recentes primeiro, com números e comentário', async () => {
  const { resumoTreinos } = await carregar();
  const lista = Array.from({ length: 7 }, (_, i) => ({ title: `T${i}`, done_at: new Date(2026, 10, 10 + i, 12).toISOString(), duration_min: 40, sets: 12, volume_kg: 0, esforco: i === 6 ? 4 : null, comentario: i === 6 ? 'ombro doeu' : null }));
  const r = resumoTreinos(lista);
  assert.equal(r.length, 5);
  assert.match(r[0], /^16\/11 T6: 40 min, 12 séries, esforço 4\/5, disse: "ombro doeu"$/);
  assert.ok(!r[0].includes(' kg'));
  assert.deepEqual(resumoTreinos('nada'), []);
  assert.deepEqual(resumoTreinos([null, 1, {}]), []);
});
