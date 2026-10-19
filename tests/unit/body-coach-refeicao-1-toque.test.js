'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const SRC = path.join(__dirname, '..', '..', 'apps', 'body-coach', 'src');
const ler = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');

async function carregar() {
  const out = ts.transpileModule(ler('lib/refeicaoUmToque.ts'), { compilerOptions: { module: ts.ModuleKind.ES2022, target: 'ES2022' } }).outputText;
  const f = path.join(fs.mkdtempSync(path.join(require('os').tmpdir(), 'r1t-')), 'm.mjs');
  fs.writeFileSync(f, out);
  return import(f);
}

test('repetir ontem: pega só as refeições de ontem, em ordem de horário', async () => {
  const m = await carregar();
  const agora = new Date(2026, 9, 19, 10, 0);
  const em = (d, h) => new Date(2026, 9, d, h).toISOString();
  const l = [
    { name: 'Almoço', time: '12:30', calories: 600, protein: 40, carbs: 60, fat: 20, created_at: em(18, 12) },
    { name: 'Café', time: '07:00', calories: 300, protein: 20, carbs: 30, fat: 10, created_at: em(18, 7) },
    { name: 'Hoje', time: '08:00', calories: 200, protein: 10, carbs: 20, fat: 5, created_at: em(19, 8) },
    { name: 'Anteontem', time: '08:00', calories: 200, protein: 10, carbs: 20, fat: 5, created_at: em(17, 8) },
    { name: 'Sem data', calories: 1, protein: 0, carbs: 0, fat: 0 },
  ];
  assert.deepStrictEqual(m.refeicoesDeOntem(l, agora).map((x) => x.name), ['Café', 'Almoço']);
});

test('foto: lê a linha ESTIMATIVA da IA e esconde ela do texto', async () => {
  const m = await carregar();
  const r = 'Boa refeição, rica em proteína.\nESTIMATIVA: kcal=520; proteina=38,5; carbo=45; gordura=18';
  assert.deepStrictEqual(m.lerEstimativa(r), { calorias: 520, proteinas: 39, carboidratos: 45, gorduras: 18 });
  assert.strictEqual(m.semLinhaEstimativa(r), 'Boa refeição, rica em proteína.');
  assert.strictEqual(m.lerEstimativa('sem números'), null);
  assert.strictEqual(m.lerEstimativa(''), null);
});

test('telas: botão Repetir ontem e Registrar refeição com valores editáveis', () => {
  assert.match(ler('pages/nutrition/components/Favoritas.tsx'), /Repetir ontem/);
  const r = ler('pages/nutrition/components/RefeicaoRapida.tsx');
  assert.match(r, /PEDIDO_ESTIMATIVA/);
  assert.match(r, /Registrar refeição/);
  assert.doesNotMatch(r, /\\n\s+\{veredito\}/);
  assert.match(ler('components/feature/NutritionContext.tsx'), /yesterdayMeals/);
});
