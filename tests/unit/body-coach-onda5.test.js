// Onda 5: Body Twin feminino, treino expresso, planilha dos treinos, cadência, "Senti dor" e pausas ativas.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');

const APP = path.join(__dirname, '../../apps/body-coach/src');
async function carregar(rel) {
  const js = ts.transpileModule(fs.readFileSync(path.join(APP, rel), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'onda5-'));
  fs.writeFileSync(path.join(dir, 'm.mjs'), js);
  return import(pathToFileURL(path.join(dir, 'm.mjs')).href);
}
const ex = (i, sets = 4, rest = 120) => ({ id: `e${i}`, name: `Ex ${i}`, targetSets: sets, restSec: rest, targetReps: '8-12' });

test('treino expresso: 4 exercícios, 2 séries, descanso curto, bi-sets e cabe em ~20 min', async () => {
  const { encurtarTreino, minutosEstimados } = await carregar('lib/treinoExpresso.ts');
  const s = { title: 'Superior', estimatedMinutes: 60, warmup: [{ name: 'a', durationSec: 60 }, { name: 'b', durationSec: 60 }], exercises: [1, 2, 3, 4, 5, 6].map((i) => ex(i)) };
  const e = encurtarTreino(s);
  assert.equal(e.exercises.length, 4);
  assert.ok(e.exercises.every((x) => x.targetSets === 2 && x.restSec <= 60));
  assert.deepEqual(e.exercises.map((x) => x.biset), [true, false, true, false]);
  assert.equal(e.title, 'Superior (expresso)');
  assert.equal(encurtarTreino(e), e); // não encurta duas vezes
  assert.ok(minutosEstimados(e) <= 20 && minutosEstimados(e) < minutosEstimados(s));
});

test('planilha dos treinos: cabeçalho, separador do Excel brasileiro e aspas escapadas', async () => {
  const { treinosEmCsv } = await carregar('lib/treinoExpresso.ts');
  const csv = treinosEmCsv([{ done_at: '2026-11-20T13:00:00.000Z', title: 'Treino "A"', duration_min: 50, sets: 18, volume_kg: 4520.5, esforco: 4, comentario: 'top; pesado', melhores: { Supino: { weight: 40, reps: 10 } } }]);
  const [cab, linha] = csv.replace('﻿', '').split('\r\n');
  assert.match(cab, /"Data";"Hora";"Treino"/);
  assert.match(linha, /"Treino ""A"""/);
  assert.match(linha, /"4520,5"/);
  assert.match(linha, /"top; pesado"/);
  assert.match(linha, /Supino 40kg x 10/);
});

test('cadência: fase e repetição certas no tempo', async () => {
  const { CADENCIAS, faseAgora } = await carregar('lib/cadencia.ts');
  const f = CADENCIAS.find((c) => c.id === '3-1-1').fases;
  assert.deepEqual(faseAgora(f, 0), { rep: 1, fase: 0, resta: 3 });
  assert.equal(faseAgora(f, 3100).fase, 1);
  assert.equal(faseAgora(f, 4100).fase, 2);
  assert.deepEqual(faseAgora(f, 5100), { rep: 2, fase: 0, resta: 3 });
});

test('Body Twin mostra mulher para aluna e pausas ativas existem', async () => {
  const img = fs.readFileSync(path.join(APP, 'pages/evolution/components/bodyImages.ts'), 'utf8');
  assert.match(img, /export function imagemDoCorpo/);
  assert.match(img, /avatar\.sexo === 'm'/);
  const resumo = fs.readFileSync(path.join(APP, 'pages/evolution/ResumoEvolucao.tsx'), 'utf8');
  assert.match(resumo, /avatar=\{lerAvatar\(profile\?\.avatar/);
  assert.doesNotMatch(resumo, /\(!mulher \|\| comFotos\) &&/);
  const { TREINOS_PRONTOS } = await carregar('lib/ferramentas/treinosProntos.ts');
  for (const id of ['pausa-pescoco', 'pausa-lombar', 'pausa-pernas']) assert.ok(TREINOS_PRONTOS.some((t) => t.id === id), id);
  const pag = fs.readFileSync(path.join(APP, 'pages/workout/page.tsx'), 'utf8');
  for (const t of ['data-testid="treino-expresso"', "id: 'senti-dor'", "id: 'abrir-cadencia'"]) assert.ok(pag.includes(t), t);
});
