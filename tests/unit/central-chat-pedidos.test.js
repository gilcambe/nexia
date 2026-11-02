'use strict';
// #2895: passo da linha do tempo do chat "Pedir ao Cortex" na Central.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const ts = require('typescript');

async function carregar() {
  const src = fs.readFileSync(path.join(__dirname, '../../src/pages/central/passoPedido.ts'), 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'passo-')), 'passo.mjs');
  fs.writeFileSync(f, out);
  return import(pathToFileURL(f).href);
}
const pr = (estado, ci = null) => ({ estado, ci });

test('CHAT1. cada situação vira o passo certo', async () => {
  const { obterPasso } = await carregar();
  assert.equal(obterPasso({ situacao: 'fila', prs: [] }), 'fila');
  assert.equal(obterPasso({ situacao: 'fazendo', prs: [] }), 'fazendo');
  assert.equal(obterPasso({ situacao: 'dividido' }), 'fazendo');
  assert.equal(obterPasso({ situacao: 'fazendo', prs: [pr('aberto', 'rodando')] }), 'testando');
  assert.equal(obterPasso({ situacao: 'fazendo', prs: [pr('aberto', null)] }), 'testando');
  assert.equal(obterPasso({ situacao: 'fazendo', prs: [pr('aberto', 'verde')] }), 'pronto');
  assert.equal(obterPasso({ situacao: 'feito', prs: [pr('juntado', 'verde')] }), 'noApp');
  assert.equal(obterPasso({ situacao: 'travado', prs: [] }), 'travado');
  assert.equal(obterPasso({ situacao: 'travado', prs: [pr('fechado')] }), 'travado');
});

test('CHAT2. o chat usa o que já existe e não cria rota nova', () => {
  const c = fs.readFileSync(path.join(__dirname, '../../src/pages/central/MeusPedidosChat.tsx'), 'utf8');
  assert.match(c, /usePedidos/);
  assert.match(c, /acao: "juntar"/);
  assert.match(c, /setInterval\(carregar, 30000\)/);
  assert.match(c, /clearInterval/);
});
