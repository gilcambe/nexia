'use strict';
// Contrato: lib/reservas.js — conflito de horários (agenda de espaço/eventos).
const test = require('node:test');
const assert = require('node:assert/strict');
const { conflita, livres } = require('../../lib/reservas');
const r = (inicio, fim) => ({ inicio, fim });
test('conflita: sobreposição real conta; encostar não conta', () => {
  assert.equal(conflita(r('10:00', '12:00'), r('11:00', '13:00')), true);
  assert.equal(conflita(r('10:00', '12:00'), r('12:00', '13:00')), false);
  assert.equal(conflita(r('09:00', '18:00'), r('10:00', '11:00')), true);
  assert.equal(conflita(r('08:00', '09:00'), r('09:30', '10:00')), false);
});
test('livres: horários de 1 h entre abertura e fechamento que não batem com reservas', () => {
  assert.deepEqual(livres('08:00', '12:00', [r('09:00', '10:30')]), ['08:00', '10:30']);
  assert.deepEqual(livres('08:00', '11:00', []), ['08:00', '09:00', '10:00']);
  assert.deepEqual(livres('08:00', '10:00', [r('08:00', '10:00')]), []);
});
