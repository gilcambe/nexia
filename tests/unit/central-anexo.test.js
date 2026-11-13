'use strict';
// #3365: anexo no "Pedir ao Cortex" da Central nova.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');

const PASTA = path.join(__dirname, '../../src/pages/central/kernex');
async function anexo() {
  const out = ts.transpileModule(fs.readFileSync(path.join(PASTA, 'anexo.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kx-anexo-'));
  fs.writeFileSync(path.join(dir, 'anexo.mjs'), out);
  return import(pathToFileURL(path.join(dir, 'anexo.mjs')).href);
}

test('ANX1. o pedido leva o nome, o caminho no ramo cortex-anexos e o que a IA leu', async () => {
  const { blocoDoAnexo } = await anexo();
  const b = blocoDoAnexo('erro.png', 'cortex-anexos/2026-11-13-abc-erro.png', ' Tela preta com "reading length" ');
  assert.match(b, /Anexo: erro\.png/);
  assert.match(b, /cortex-anexos\/2026-11-13-abc-erro\.png/);
  assert.match(b, /lido pela IA\): Tela preta com "reading length"$/);
});

test('ANX2. sem caminho ou sem leitura, o bloco não inventa nada; texto da IA é cortado', async () => {
  const { blocoDoAnexo, MAX_BYTES } = await anexo();
  assert.equal(blocoDoAnexo('a.pdf', null, null), '📎 Anexo: a.pdf');
  assert.ok(blocoDoAnexo('a.pdf', null, 'x'.repeat(5000)).length < 1600);
  assert.ok(MAX_BYTES * 4 / 3 < 950000, 'o limite da tela cabe no limite do servidor (base64)');
});

test('ANX3. a tela inicial tem o botão de anexar e manda as ações que o servidor conhece', () => {
  const tela = fs.readFileSync(path.join(PASTA, 'Inicio.tsx'), 'utf8');
  const srv = fs.readFileSync(path.join(__dirname, '../../netlify/functions/central/pedidos-acoes.js'), 'utf8');
  assert.match(tela, /data-testid="kx-anexar"/);
  for (const acao of ['anexar', 'entender']) {
    assert.ok(tela.includes(`acao: "${acao}"`), 'tela sem ' + acao);
    assert.ok(srv.includes(`b.acao === '${acao}'`), 'servidor sem ' + acao);
  }
});