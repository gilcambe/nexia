// Contrato (melhoria 10): reserva de emergência. netlify/functions/prumo-lib/reserva.js exporta
// reservaEmergencia({ gasto_mensal, guardado, meses, aporte }) e agirReserva (ação 'reserva_status', ligada em agirExtra:
// gasto_mensal = média das despesas realizadas dos 3 últimos meses completos; guardado = saldo das contas tipo 'poupanca';
// meses = config/reserva.meses (padrão 6); aporte = config/reserva.aporte (opcional)). Ação 'reserva_salvar' { meses, aporte }.
// Devolve { alvo = gasto_mensal*meses, guardado, falta = max(0, alvo-guardado), pct (0..100, 1 casa), meses_para_completar (inteiro, arredonda pra cima; null sem aporte) }.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.join(__dirname, '../..');
const extra = fs.readFileSync(path.join(raiz, 'netlify/functions/prumo-lib/extra.js'), 'utf8');
const rv = require(path.join(raiz, 'netlify/functions/prumo-lib/reserva.js'));
test('alvo, falta e quanto tempo', () => {
  assert.deepEqual(rv.reservaEmergencia({ gasto_mensal: 5000, guardado: 12000, meses: 6, aporte: 1000 }), { alvo: 30000, guardado: 12000, falta: 18000, pct: 40, meses_para_completar: 18 });
});
test('meses padrão 6, completa, sem aporte', () => {
  const r = rv.reservaEmergencia({ gasto_mensal: 1000, guardado: 9000 }); assert.equal(r.alvo, 6000); assert.equal(r.falta, 0); assert.equal(r.pct, 100); assert.equal(r.meses_para_completar, 0);
  assert.equal(rv.reservaEmergencia({ gasto_mensal: 1000, guardado: 0 }).meses_para_completar, null);
});
test('ações ligadas', () => { assert.match(fs.readFileSync(path.join(raiz, 'netlify/functions/prumo-lib/reserva.js'), 'utf8'), /'reserva_salvar'/); assert.match(extra, /require\('\.\/reserva'\)/); });
