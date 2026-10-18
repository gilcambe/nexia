'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { diagnosticar } = require('../../scripts/vigia-cortex.js');

const i = (number, title, labels = []) => ({ number, title, labels: ['cortex-fila', ...labels].map((name) => ({ name })) });
const agora = Date.parse('2026-10-17T12:00:00Z');

test('VIG1. partes atrás de uma parte travada contam como paradas', () => {
  const d = diagnosticar([i(1, '[Parte 1/3 de #9] a', ['cortex-travado']), i(2, '[Parte 2/3 de #9] b'), i(3, '[Parte 3/3 de #9] c')], '2026-10-17T11:00:00Z', agora);
  assert.strictEqual(d.parado, true); assert.strictEqual(d.andando, 0); assert.deepStrictEqual(d.travadas, [1]);
});

test('VIG2. fila andando e entrega recente: tudo bem', () => {
  const d = diagnosticar([i(4, 'pedido novo')], '2026-10-17T10:00:00Z', agora);
  assert.strictEqual(d.parado, false);
});

test('VIG3. fila vazia ou sem entrega em 24 h: alerta', () => {
  assert.strictEqual(diagnosticar([], '2026-10-17T10:00:00Z', agora).parado, true);
  assert.strictEqual(diagnosticar([i(5, 'x')], '2026-10-15T10:00:00Z', agora).parado, true);
});
