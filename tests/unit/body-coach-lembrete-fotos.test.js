'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

async function carregar() {
  const src = fs.readFileSync(path.join(__dirname, '../../apps/body-coach/src/lib/lembretes.ts'), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  const f = path.join(require('os').tmpdir(), `lembretes-${process.pid}.mjs`);
  fs.writeFileSync(f, js);
  return import(f);
}

test('BCLF1. lembrete de fotos: dias desde a última e evento semanal no calendário', async () => {
  const l = await carregar();
  const agora = new Date('2026-10-18T12:00:00Z');
  assert.equal(l.diasSemFotos([], agora), null);
  assert.equal(l.diasSemFotos(['2026-10-01T10:00:00Z', '2026-10-15T10:00:00Z'], agora), 3);
  assert.match(l.gerarIcs({ dias: ['MO'], hora: '18:00', incluirFotos: true }), /Fotos de evolução da semana/);
  assert.doesNotMatch(l.gerarIcs({ dias: ['MO'], hora: '18:00' }), /Fotos de evolução/);
});
