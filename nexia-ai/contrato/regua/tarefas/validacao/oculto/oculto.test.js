const { test } = require('node:test'); const assert = require('node:assert');
const { criarReserva } = require('../src/reserva');
const ok = { unidade: '101', data: '2026-12-20', convidados: 30 };
test('qualquer corpo estranho: 400 e nunca exceção', () => {
  for (const c of [null, undefined, 'x', 42, [], {}]) { const r = criarReserva(c); assert.strictEqual(r.status, 400, JSON.stringify(c)); assert.ok(r.json.erro); }
});
test('tipos e limites', () => {
  for (const c of [{ ...ok, convidados: '30' }, { ...ok, convidados: 0 }, { ...ok, convidados: 101 }, { ...ok, convidados: 2.5 },
    { ...ok, unidade: '' }, { ...ok, unidade: 'x'.repeat(11) }, { ...ok, unidade: 101 }, { ...ok, data: '20/12/2026' }, { ...ok, data: '2026-13-01' }])
    assert.strictEqual(criarReserva(c).status, 400, JSON.stringify(c));
});
test('limites válidos', () => { for (const n of [1, 100]) assert.strictEqual(criarReserva({ ...ok, convidados: n }).status, 201); });
