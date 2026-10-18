'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const SRC = path.join(__dirname, '..', '..', 'apps', 'body-coach', 'src');

test('favoritas: alterna a estrela, limita a 12 e a página mostra o cartão', async () => {
  const out = ts.transpileModule(fs.readFileSync(path.join(SRC, 'lib/refeicoesFavoritas.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022, target: 'ES2022' } }).outputText;
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fav-'));
  const f = path.join(dir, 'fav.mjs');
  fs.writeFileSync(f, out);
  const store = {};
  global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
  const m = await import(f);
  const a = { name: 'Ovos', calories: 150, protein: 12, carbs: 1, fat: 10, fiber: 0 };
  let l = m.alternarFavorita(m.lerFavoritas(), a);
  assert.strictEqual(m.ehFavorita(l, 'ovos'), true);
  assert.strictEqual(m.lerFavoritas().length, 1);
  l = m.alternarFavorita(l, a);
  assert.strictEqual(l.length, 0);
  for (let i = 0; i < 20; i++) l = m.alternarFavorita(l, { ...a, name: 'R' + i });
  assert.strictEqual(l.length, 12);
  assert.match(fs.readFileSync(path.join(SRC, 'pages/nutrition/page.tsx'), 'utf8'), /<Favoritas \/>/);
});
