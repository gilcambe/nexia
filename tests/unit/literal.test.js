'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { arquivosLiterais, temEdicaoExtra } = require('../../nexia-ai/orchestrator/literal');

const F = '```';
const um = `Parte 1 de #9. Copie EXATAMENTE. Só 1 arquivo novo: \`a/b.js\` com este conteúdo, sem mudar nada:\n\n${F}js\nconst x = 1;\n\nmodule.exports = { x };\n${F}\nNada além disso.`;

test('LIT1. um arquivo novo no bloco de código, byte a byte, com quebra de linha no fim', () => {
  const r = arquivosLiterais(um);
  assert.deepStrictEqual(r, [{ path: 'a/b.js', content: 'const x = 1;\n\nmodule.exports = { x };\n' }]);
  assert.strictEqual(temEdicaoExtra(um), false);
});

test('LIT2. dois arquivos, cada um com seu bloco', () => {
  const m = `Copie EXATAMENTE. 2 arquivos novos.\n\n\`.github/workflows/v.yml\`:\n${F}yaml\nname: V\n${F}\n\n\`tests/unit/v.test.js\`:\n${F}js\nok();\n${F}`;
  assert.deepStrictEqual(arquivosLiterais(m).map(f => f.path), ['.github/workflows/v.yml', 'tests/unit/v.test.js']);
});

test('LIT3. sem "Copie EXATAMENTE" não há cópia literal', () => {
  assert.deepStrictEqual(arquivosLiterais(um.replace('Copie EXATAMENTE', 'Faça')), []);
});

test('LIT4. caminho fora do projeto é recusado', () => {
  assert.deepStrictEqual(arquivosLiterais(`Copie EXATAMENTE \`../x.js\` assim:\n${F}js\n1\n${F}`), []);
  assert.deepStrictEqual(arquivosLiterais(`Copie EXATAMENTE \`/etc/x.js\` assim:\n${F}js\n1\n${F}`), []);
});

test('LIT5. pedido que também manda editar arquivo existente ainda chama o agente', () => {
  assert.strictEqual(temEdicaoExtra(`${um}\nE em \`cloudflare/functions.js\` acrescente uma linha.`), true);
});
