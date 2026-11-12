const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

// Importar a implementação. Pode exportar a função diretamente ou como propriedade 'isOpen'.
const expedienteModule = require('../../lib/expediente');
const isOpen = typeof expedienteModule === 'function' ? expedienteModule : expedienteModule.isOpen;

if (typeof isOpen !== 'function') {
  throw new Error('lib/expediente.js deve exportar uma função (directa ou como isOpen)');
}

test('verifica horários de funcionamento da loja', (t) => {
  // Caso comum: segunda‑feira às 09:30 → aberto
  assert.ok(isOpen(1, '09:30'), 'Segunda‑feira 09:30 deve estar aberto');

  // Caso de borda: sexta‑feira às 18:00 → fechado (fechamento pontual)
  assert.ok(!isOpen(5, '18:00'), 'Sexta‑feira 18:00 deve estar fechado');

  // Caso de borda: sábado às 12:00 → fechado (último minuto ainda aberto, 12:01 fechado)
  assert.ok(isOpen(6, '11:59'), 'Sábado 11:59 deve estar aberto');
  assert.ok(!isOpen(6, '12:00'), 'Sábado 12:00 deve estar fechado');

  // Entrada inválida: dia fora do intervalo
  assert.ok(!isOpen(7, '10:00'), 'Dia 7 (inválido) deve retornar false');

  // Entrada inválida: formato de hora incorreto
  assert.ok(!isOpen(2, '25:00'), 'Hora 25:00 (inválida) deve retornar false');
});