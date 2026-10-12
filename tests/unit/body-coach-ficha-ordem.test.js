// O treino do dia segue a ordem da ficha (apps/body-coach/src/lib/ficha.ts), mesmo com o ajuste do dia (sono, tempo, ênfase).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');

async function carregar() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-ficha-'));
  for (const nome of ['exerciseDb', 'dayPlan', 'ficha']) {
    const src = fs.readFileSync(path.join(__dirname, `../../apps/body-coach/src/lib/${nome}.ts`), 'utf8');
    const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
      .replace(/from '\.\/(exerciseDb|dayPlan)'/g, "from './$1.mjs'")
      .replace(/import\.meta\.env\.BASE_URL/g, "'/'");
    fs.writeFileSync(path.join(dir, `${nome}.mjs`), out);
  }
  return import(pathToFileURL(path.join(dir, 'ficha.mjs')).href);
}

const R = { level: 'intermediario', goal: 'hipertrofia', minutes: 60, days: 3, mobility: [] };

test('treino do dia com ajuste (sono ruim, jejum, menos tempo, ênfase) mantém a ordem da ficha', async () => {
  const { treinoDaFicha } = await carregar();
  for (const dia of [0, 1, 2]) {
    const ficha = treinoDaFicha(R, 'abc', dia).sessao.exercises.map((e) => e.id);
    const estados = [
      { sono: 'bom', alimentacao: 'comi_bem', energia: 4, tempoMin: 60, dores: '', indisponiveis: [] },
      { sono: 'ruim', alimentacao: 'jejum', energia: 2, tempoMin: 45, dores: '', indisponiveis: [] },
      { sono: 'bom', alimentacao: 'comi_bem', energia: 5, tempoMin: 75, dores: '', indisponiveis: [] },
    ];
    for (const est of estados) {
      for (const enfase of [[], ['ombros'], ['triceps', 'peito'], ['biceps']]) {
        const hoje = treinoDaFicha(R, 'abc', dia, est, enfase).sessao.exercises.map((e) => e.id);
        const daFicha = hoje.filter((id) => ficha.includes(id));
        assert.deepEqual(daFicha, ficha.filter((id) => daFicha.includes(id)), `dia ${dia}, ${est.tempoMin} min, ênfase ${enfase}`);
        const extras = hoje.slice(daFicha.length);
        assert.ok(extras.every((id) => !ficha.includes(id)), 'exercícios a mais vão para o fim');
      }
    }
  }
});

test('sem ajuste do dia, o treino é exatamente a ficha', async () => {
  const { treinoDaFicha, estadoPadrao } = await carregar();
  const a = treinoDaFicha(R, 'abc', 0).sessao.exercises.map((e) => e.id);
  const b = treinoDaFicha(R, 'abc', 0, estadoPadrao(R), []).sessao.exercises.map((e) => e.id);
  assert.deepEqual(b, a);
});
