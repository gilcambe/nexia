'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('BRANDING1. index.html exibe KERNEX no title e og:title, sem NEXIA OS', () => {
  const file = path.join(__dirname, '../../index.html');
  const code = fs.readFileSync(file, 'utf8');
  assert.ok(code.includes('<title>KERNEX — Sistema Operacional de Inteligência Artificial</title>'), 'title deve ser KERNEX');
  assert.ok(code.includes('<meta property="og:title" content="KERNEX — Sistema Operacional de Inteligência Artificial" />'), 'og:title deve ser KERNEX');
  assert.ok(!code.includes('<title>NEXIA OS'), 'title não deve ter NEXIA OS');
  assert.ok(!code.includes('content="NEXIA OS'), 'og:title não deve ter NEXIA OS');
});

test('BRANDING2. Lateral.tsx exibe KERNEX no menu do Cortex', () => {
  const file = path.join(__dirname, '../../src/pages/cortex/Lateral.tsx');
  const code = fs.readFileSync(file, 'utf8');
  assert.ok(code.includes('">KERNEX</p>'), 'menu lateral do Cortex deve exibir KERNEX');
});
