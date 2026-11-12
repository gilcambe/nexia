'use strict';
// 12/11/2026: a Central nova quebrava logo após o login ("Cannot read properties of undefined (reading 'length')"):
// o servidor do Cortex não manda mais `travadas`, e o cálculo de avisos da Central antiga lia d.cortex.travadas.length.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..', '..');

test('CAD1. calcularAvisos aguenta dados parciais (cortex sem travadas, divulga sem histórico, lista sem produtos)', async () => {
  const ts = require('typescript');
  const src = fs.readFileSync(path.join(RAIZ, 'src/pages/central/avisos.ts'), 'utf8');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cad-'));
  fs.writeFileSync(path.join(dir, 'avisos.mjs'), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  const { calcularAvisos } = await import(require('node:url').pathToFileURL(path.join(dir, 'avisos.mjs')).href);
  for (const d of [{}, { cortex: {} }, { cortex: { contagens: {} }, divulga: {}, lista: {} }, { divulga: { historico: [{}] } }]) {
    assert.ok(Array.isArray(calcularAvisos(d)), JSON.stringify(d));
  }
});

test('CAD2. a Central nova não carrega os dados da antiga (só com ?antiga=1)', () => {
  const p = fs.readFileSync(path.join(RAIZ, 'src/pages/central/page.tsx'), 'utf8');
  assert.match(p, /user && antiga\) conferir\(\)/);
  assert.match(p, /if \(!user \|\| !antiga\) return;/);
});
