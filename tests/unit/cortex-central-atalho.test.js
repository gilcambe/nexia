'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('CENTRAL-ATALHO1. Lateral.tsx exibe atalho Central de controle somente para o admin gcbezerra@gmail.com', () => {
  const file = path.join(__dirname, '../../src/pages/cortex/Lateral.tsx');
  const code = fs.readFileSync(file, 'utf8');
  assert.ok(code.includes('email === "gcbezerra@gmail.com"'), 'Lateral.tsx deve verificar email do admin');
  assert.ok(code.includes('m.id !== "central" || isAdmin'), 'Lateral.tsx deve filtrar o menu da central pelo isAdmin');
  assert.ok(code.includes('data-testid={`cx-menu-${m.id}`}'), 'Lateral.tsx deve conter testid dinâmico do menu');
});

test('CENTRAL-ATALHO2. page.tsx exibe o botão Central no topo para o admin e navega para /central', () => {
  const file = path.join(__dirname, '../../src/pages/cortex/page.tsx');
  const code = fs.readFileSync(file, 'utf8');
  assert.ok(code.includes('user?.email === "gcbezerra@gmail.com"'), 'page.tsx deve definir isAdmin para o email do dono');
  assert.ok(code.includes('data-testid="cx-central"'), 'page.tsx deve conter botão com testid cx-central');
  assert.ok(code.includes('navigate("/central")'), 'page.tsx deve navegar para /central ao clicar');
  assert.ok(code.includes('if (v === "central")'), 'page.tsx deve tratar a vista central no ir()');
});
