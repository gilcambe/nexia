'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('PAN1. Paineis.tsx contém cx-lista-tentar, cx-lista-cancelar, cx-lista-reabrir e cx-tarefas-busca', () => {
  const file = path.join(__dirname, '../../src/pages/cortex/Paineis.tsx');
  const code = fs.readFileSync(file, 'utf8');
  assert.ok(code.includes('data-testid="cx-lista-tentar"'), 'deve conter cx-lista-tentar');
  assert.ok(code.includes('data-testid="cx-lista-cancelar"'), 'deve conter cx-lista-cancelar');
  assert.ok(code.includes('data-testid="cx-lista-reabrir"'), 'deve conter cx-lista-reabrir');
  assert.ok(code.includes('data-testid="cx-tarefas-busca"'), 'deve conter cx-tarefas-busca');
  assert.ok(code.includes('setTimeout'), 'deve usar debounce de busca');
});

test('PAN2. Conversa.tsx possui o botão de voltar sem md:hidden', () => {
  const file = path.join(__dirname, '../../src/pages/cortex/Conversa.tsx');
  const code = fs.readFileSync(file, 'utf8');
  assert.ok(code.includes('data-testid="cx-voltar"'), 'deve conter cx-voltar');
  assert.ok(!/className="[^"]*md:hidden[^"]*"\s*aria-label="Voltar"/.test(code), 'botão voltar não deve ter md:hidden');
});
