'use strict';
// 23/11/2026: contrato com "Arquivos:" e sem "Teste:" deve ir para o gerador, não parar como inválido.
const test = require('node:test');
const assert = require('node:assert');
const { precisaGerar } = require('../../nexia-ai/contrato/gerador');
const { lerContrato } = require('../../nexia-ai/contrato/executor');

test('Arquivos sem Teste: gera o teste', () => {
  const t = 'Criar x.\n\nArquivos: `nexia-ai/x.js`, `tests/unit/x.test.js`\nPronto quando: `node --test tests/unit/x.test.js` passa';
  assert.equal(precisaGerar(t, lerContrato(t)), true);
});
test('sem Arquivos e sem Teste: gera o teste (como antes)', () => {
  const t = 'Criar uma função que soma.';
  assert.equal(precisaGerar(t, lerContrato(t)), true);
});
test('com Teste quebrado: não gera (o contrato precisa ser corrigido)', () => {
  const t = 'Criar x.\nArquivos: `a.js`\nTeste: `npm test`';
  assert.equal(precisaGerar(t, lerContrato(t)), false);
});
test('contrato válido: não gera', () => {
  const t = 'Criar x.\nArquivos: `a.js`\nTeste: `node --test tests/unit/a.test.js`';
  assert.equal(precisaGerar(t, lerContrato(t)), false);
});
