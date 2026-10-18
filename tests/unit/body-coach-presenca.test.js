'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { registrar, ultimos, MAX } = require('../../netlify/functions/body-coach/presenca');

test('PRES1. treino concluído entra no histórico com o nome do treino', () => {
  const agora = Date.now();
  const h = registrar({}, { titulo: 'A · Peito e tríceps', minutos: 62, kcal: 410 }, agora);
  assert.deepEqual(h[0], { em: agora, titulo: 'A · Peito e tríceps', min: 62, kcal: 410 });
});

test('PRES2. treino salvo sem internet conta no dia em que foi feito e não duplica', () => {
  const agora = Date.now();
  const feito = agora - 2 * 86400000;
  const h1 = registrar({}, { titulo: 'B', feitoEm: feito }, agora);
  assert.equal(h1[0].em, feito);
  assert.equal(registrar({ historico: h1 }, { titulo: 'B', feitoEm: feito }, agora).length, 1);
});

test('PRES3. histórico tem limite e a lista do coach só traz os últimos dias', () => {
  const agora = Date.now();
  let eu = {};
  for (let i = 0; i < MAX + 5; i++) eu = { historico: registrar(eu, { titulo: `T${i}`, feitoEm: agora - 1000 * (i % 50) - i }, agora) };
  assert.ok(eu.historico.length <= MAX);
  assert.equal(ultimos({ historico: [{ em: agora - 70 * 86400000, titulo: 'velho' }, { em: agora - 1000, titulo: 'novo' }] }, 60, agora).length, 1);
});
