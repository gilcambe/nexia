'use strict';
// Melhoria 29 do Cortex: testes vizinhos rodam sempre (caso #3942: tela do Salário quebrou prumo-app.test.js PA9).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { regressaoPadrao, chaves } = require('../../nexia-ai/contrato/regressao');
const raiz = path.join(__dirname, '../..');

test('chaves: 1ª pasta e nome do arquivo, sem nomes genéricos', () => {
  assert.deepEqual(chaves('prumo/orcamento.js'), ['prumo', 'orcamento']);
  assert.deepEqual(chaves('netlify/functions/prumo-lib/salario.js'), ['prumo', 'salario']);
  assert.deepEqual(chaves('src/app.js'), []);
});

test('caso real #3942: arquivos do prumo trazem prumo-app.test.js e não o teste do contrato', () => {
  const cmd = regressaoPadrao(['prumo/salario.js', 'prumo/orcamento.js', 'prumo/sw.js'], raiz, ['tests/contrato/finance-salario-tela.test.js']);
  assert.match(cmd, /^node --test /);
  assert.match(cmd, /tests\/unit\/prumo-app\.test\.js/);
  assert.doesNotMatch(cmd, /tests\/contrato\//);
  assert.doesNotMatch(cmd, /body-coach|bodycoach/);
  assert.ok(cmd.split(' ').length - 2 <= 40);
  for (const f of cmd.split(' ').slice(2)) assert.ok(fs.existsSync(path.join(raiz, f)), f);
});

test('formato aceito pelo cortex-contrato (mesma regra)', () => {
  const cmd = regressaoPadrao(['netlify/functions/prumo.js'], raiz);
  assert.match(cmd, /^node --test(?: --test-(?:force-exit|timeout=\d{1,6}|concurrency=\d{1,2}))*(?: [\w@./*-]+\.test\.(?:js|cjs|mjs))+$/);
});

test('sem testes vizinhos: string vazia (o executor segue sem regressão)', () => {
  assert.equal(regressaoPadrao(['zzzz-inexistente/qqq.js'], raiz), '');
});
