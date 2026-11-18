'use strict';
// HOTFIX 18/11: o Finance caiu (todo pedido parado 25 s). Cada pedido fazia uma transação no Firestore no MESMO
// documento por pessoa (limite de pedidos) e os 4–6 pedidos simultâneos do app travavam uns aos outros.
// Regra: o Finance NÃO faz transação de limite no banco; o limite fica na memória.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const p = require('../../netlify/functions/prumo.js');

test('o Finance não usa o limite de pedidos com transação no Firestore', () => {
  const s = fs.readFileSync(path.join(__dirname, '../../netlify/functions/prumo.js'), 'utf8');
  assert.doesNotMatch(s, /checkRateLimit\(/);
  assert.doesNotMatch(s, /runTransaction/);
});

test('limite na memória: 300 por minuto por pessoa, renova no minuto seguinte', () => {
  const t0 = 1_000_000;
  for (let i = 0; i < 300; i++) assert.equal(p.dentroDoLimite('x', t0 + i), true);
  assert.equal(p.dentroDoLimite('x', t0 + 400), false);
  assert.equal(p.dentroDoLimite('outra', t0 + 400), true, 'cada pessoa tem o seu');
  assert.equal(p.dentroDoLimite('x', t0 + 61000), true, 'renova');
});
