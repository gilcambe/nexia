'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

async function carregar() {
  const src = fs.readFileSync(path.join(__dirname, '../../apps/body-coach/src/lib/coach/importarAlunos.ts'), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  const f = path.join(require('os').tmpdir(), `importar-alunos-${process.pid}.mjs`);
  fs.writeFileSync(f, js);
  return import(f);
}

test('BCIA1. valida o JSON da IA: aceita markdown, descarta inválidos e repetidos', async () => {
  const { alunosDoJson, alunosParaTexto } = await carregar();
  const r = alunosDoJson('```json\n[{"nome":"Maria","email":"MARIA@x.com","telefone":""},{"nome":"","email":"a@b.com"},{"nome":"Zé","email":"ruim","telefone":"(11) 98888-7777"},{"nome":"Maria 2","email":"maria@x.com"},{"nome":"Sem contato"}]\n```');
  assert.equal(r.length, 2);
  assert.equal(r[0].email, 'maria@x.com');
  assert.equal(r[1].email, '');
  assert.equal(alunosDoJson('sem json').length, 0);
  assert.equal(alunosParaTexto(r).split('\n').length, 2);
});
