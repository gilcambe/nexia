'use strict';
// Contrato: lib/dias-uteis.js — prazo de entrega em dias úteis (sem sábado, domingo e feriados informados).
const test = require('node:test');
const assert = require('node:assert/strict');
const { somarDiasUteis } = require('../../lib/dias-uteis');
test('somarDiasUteis pula fim de semana e feriados (datas AAAA-MM-DD)', () => {
  assert.equal(somarDiasUteis('2026-11-11', 1), '2026-11-12');   // quarta -> quinta
  assert.equal(somarDiasUteis('2026-11-13', 1), '2026-11-16');   // sexta -> segunda
  assert.equal(somarDiasUteis('2026-11-13', 3), '2026-11-18');
  assert.equal(somarDiasUteis('2026-11-19', 1, ['2026-11-20']), '2026-11-23'); // feriado na sexta
  assert.equal(somarDiasUteis('2026-11-14', 0), '2026-11-14');
});
