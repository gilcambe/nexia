'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { mexeEmWorkflow } = require('../../cloudflare/jules-auto.js');

test('mexeEmWorkflow: #3171 deve retornar false', () => {
  const i = { title: 'Corrigir botão na página inicial', body: 'Fazer ajuste simples em src/App.jsx' };
  assert.strictEqual(mexeEmWorkflow(i), false);
});

test('mexeEmWorkflow: #2389 deve retornar true', () => {
  const i = { title: 'Atualizar workflow do github', body: 'Modificar .github/workflows/deploy.yml' };
  assert.strictEqual(mexeEmWorkflow(i), true);
});
