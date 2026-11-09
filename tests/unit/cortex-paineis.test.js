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

test('PAN3. Paineis.tsx contém botão cx-tentar-3 e função tentarAlgumas para 3 travadas (#2304)', () => {
  const file = path.join(__dirname, '../../src/pages/cortex/Paineis.tsx');
  const code = fs.readFileSync(file, 'utf8');
  assert.ok(code.includes('data-testid="cx-tentar-3"'), 'deve conter o botão cx-tentar-3');
  assert.ok(code.includes('Tentar 3 travadas'), 'texto do botão deve ser Tentar 3 travadas');
  assert.ok(code.includes('.slice(0, 3)'), 'deve selecionar até 3 tarefas travadas');
  assert.ok(code.includes('setTimeout(r, 1500)') || code.includes('1500'), 'deve esperar 1,5s entre chamadas');
  assert.ok(code.includes('Mandei ${travadas.length} para a fila. Toque de novo para mandar mais 3.'), 'deve exibir mensagem ao usuário');
});
