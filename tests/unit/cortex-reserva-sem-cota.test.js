'use strict';
// #803: reserva sem cota → rótulo cortex-reserva-sem-cota, aviso na Central e volta para a fila no dia seguinte, do zero.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { decidir, reservaVolta, reservasQueVoltam } = require('../../scripts/cortex-fila');

const issue = (n, labels) => ({ number: n, body: 'x', author_association: 'OWNER', labels: ['cortex-fila', ...labels].map(name => ({ name })) });

test('R4a. com o rótulo, a tarefa não é despachada hoje', () => {
  const a = decidir({ issues: [issue(1, ['cortex-reserva-sem-cota', 'tentativa-4']), issue(2, [])], runs: [], pistas: 2 });
  assert.deepEqual(a.map(x => [x.tipo, x.numero]), [['despachar', 2]]);
});

test('R4b. volta no dia seguinte (Brasília), sem espera fixa', () => {
  const rotulado = '2026-10-20T20:00:00Z';                          // 17h em Brasília
  assert.equal(reservaVolta(rotulado, Date.parse('2026-10-21T02:00:00Z')), false, '23h do mesmo dia: ainda não');
  assert.equal(reservaVolta(rotulado, Date.parse('2026-10-21T03:01:00Z')), true, 'meia-noite e um: volta');
});

test('R4c. ação reserva-volta tira o rótulo e zera tentativa-N', async () => {
  const antes = global.fetch;
  global.fetch = async () => ({ status: 200, text: async () => JSON.stringify([{ event: 'labeled', label: { name: 'cortex-reserva-sem-cota' }, created_at: '2026-10-19T12:00:00Z' }]) });
  try {
    const v = await reservasQueVoltam('t', [issue(7, ['cortex-reserva-sem-cota', 'tentativa-4'])], Date.parse('2026-10-20T12:00:00Z'));
    assert.deepEqual(v.map(x => [x.tipo, x.numero]), [['reserva-volta', 7]]);
  } finally { global.fetch = antes; }
  const fila = fs.readFileSync(path.join(__dirname, '../../scripts/cortex-fila.js'), 'utf8');
  assert.match(fila, /acao\.tipo === 'reserva-volta'/);
  assert.match(fila, /\(tentativa\|sem-entrega\|pista\)/);
  assert.match(fs.readFileSync(path.join(__dirname, '../../.github/workflows/cortex-reserva.yml'), 'utf8'), /--add-label cortex-reserva-sem-cota/);
});
