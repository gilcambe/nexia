const { test } = require('node:test'); const assert = require('node:assert');
const { criarReserva } = require('../src/reserva');
test('reserva válida', () => {
  const r = criarReserva({ unidade: '101', data: '2026-12-20', convidados: 30 });
  assert.strictEqual(r.status, 201); assert.strictEqual(r.json.ok, true);
});
test('sem unidade', () => { assert.strictEqual(criarReserva({ data: '2026-12-20', convidados: 30 }).status, 400); });
