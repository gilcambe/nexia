'use strict';
// #1629 / #2389: teste de carga do Cortex (cálculos e regras de segurança do script).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { percentil, resumir, args } = require('../../scripts/cortex-carga.js');

test('CG1. percentil', () => {
  const v = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  assert.equal(percentil(v, 50), 50); assert.equal(percentil(v, 95), 100); assert.equal(percentil([], 95), null);
});

test('CG2. 5xx ou p95 acima da meta = não passou', () => {
  const bom = Array.from({ length: 20 }, () => ({ status: 200, ms: 300 }));
  assert.equal(resumir(bom, { modo: 'falso', pessoas: 20, duracaoMs: 400 }).passou, true);
  assert.equal(resumir([...bom, { status: 502, ms: 100 }], { modo: 'falso', pessoas: 21, duracaoMs: 400 }).passou, false);
  assert.equal(resumir(bom.map((r) => ({ ...r, ms: 5000 })), { modo: 'falso', pessoas: 20, duracaoMs: 5000 }).passou, false);
});

test('CG3. modo real nunca passa de 5 mensagens; padrão é falso', () => {
  assert.equal(args(['--real', '--pessoas', '1000']).pessoas, 5);
  assert.equal(args(['--pessoas', '200']).modo, 'falso');
});

test('CG4. workflow só manual, 20 min, padrão falso', () => {
  const y = fs.readFileSync(path.join(__dirname, '../../.github/workflows/cortex-carga.yml'), 'utf8');
  assert.match(y, /workflow_dispatch/); assert.doesNotMatch(y, /schedule:/);
  assert.match(y, /timeout-minutes: 20/); assert.match(y, /default: 'falso'/);
});
