'use strict';
// C2-F1 parte 2 (PC 2, 13/11): todo aviso de tarefa parada diz a causa, o passo a passo e se precisa do dono.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');

const PASTA = path.join(__dirname, '../../src/pages/central/kernex');
async function mod() {
  const out = ts.transpileModule(fs.readFileSync(path.join(PASTA, 'comoResolver.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kx-cr-'));
  fs.writeFileSync(path.join(dir, 'm.mjs'), out);
  return import(pathToFileURL(path.join(dir, 'm.mjs')).href);
}

test('CR1. cada motivo conhecido vira causa + passos, e diz quem resolve', async () => {
  const { comoResolver } = await mod();
  const casos = [
    ['OpenRouter 429 Too Many Requests', 'cota', false],
    ['Falhou no CI: 3 testes vermelhos', 'teste', false],
    ['merge conflict em src/x.ts', 'conflito', false],
    ['não testável: sem critério de aceite', 'sem-criterio', true],
    ['precisa de decisão do dono', 'decisao', true],
    [null, 'outro', false],
  ];
  for (const [motivo, tipo, dono] of casos) {
    const s = comoResolver(motivo);
    assert.equal(s.tipo, tipo, String(motivo));
    assert.equal(s.precisaDono, dono, String(motivo));
    assert.ok(s.causa.length > 10 && s.passos.length >= 1, String(motivo));
  }
});

test('CR2. o Início nunca mostra só o número de travadas', async () => {
  const { fraseTravadas } = await mod();
  assert.equal(fraseTravadas(0), '');
  assert.match(fraseTravadas(19), /Cortex já está tentando de novo/);
  assert.match(fraseTravadas(19, 2), /2 precisa\(m\) de uma resposta sua.*como resolver/);
  const inicio = fs.readFileSync(path.join(PASTA, 'Inicio.tsx'), 'utf8');
  assert.doesNotMatch(inicio, /As IAs podem tentar de novo\.`/);
  assert.match(inicio, /fraseTravadas\(/);
  assert.match(fs.readFileSync(path.join(PASTA, 'Tarefas.tsx'), 'utf8'), /data-testid="kx-como-resolver"/);
});
