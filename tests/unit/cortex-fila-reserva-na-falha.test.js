'use strict';
// Reserva na 1ª falha e reabertura das tarefas travadas pela queda do Cofre (decisões puras, sem rede).
const test = require('node:test');
const assert = require('node:assert');
const { devePedirReserva, travouAntesDoConserto } = require('../../scripts/cortex-fila');

test('RF1. reenfileirar por falha, sem reserva-tentou: chama a reserva', () => {
  assert.equal(devePedirReserva({ tipo: 'reenfileirar', conclusao: 'failure' }, ['cortex-fila'], {}), true);
  assert.equal(devePedirReserva({ tipo: 'reenfileirar', conclusao: 'timed_out' }, [], {}), true);
});

test('RF2. cota do banco e execução parada não contam como falha da tarefa', () => {
  assert.equal(devePedirReserva({ tipo: 'reenfileirar', conclusao: 'cota do banco' }, [], {}), false);
  assert.equal(devePedirReserva({ tipo: 'reenfileirar', conclusao: 'sem execução' }, [], {}), false);
});

test('RF3. só uma vez por tarefa (reserva-tentou)', () => {
  assert.equal(devePedirReserva({ tipo: 'reenfileirar', conclusao: 'failure' }, ['reserva-tentou'], {}), false);
  assert.equal(devePedirReserva({ tipo: 'travar' }, ['reserva-tentou'], {}), false);
});

test('RF4. travar sem reserva-tentou chama a reserva; outras ações não', () => {
  assert.equal(devePedirReserva({ tipo: 'travar' }, [], {}), true);
  assert.equal(devePedirReserva({ tipo: 'concluir' }, [], {}), false);
});

test('RF5. RESERVA_NA_FALHA=0 desliga', () => {
  assert.equal(devePedirReserva({ tipo: 'travar' }, [], { RESERVA_NA_FALHA: '0' }), false);
});

test('RF6. travouAntesDoConserto: antes do corte do conserto volta, depois não', () => {
  assert.equal(travouAntesDoConserto('2026-10-27T10:00:00Z'), true);
  assert.equal(travouAntesDoConserto('2026-10-28T13:00:00Z'), true);
  assert.equal(travouAntesDoConserto('2026-10-30T10:00:00Z'), false);
  assert.equal(travouAntesDoConserto(null), false);
});

// PR que só traz o pipeline modelo não é a entrega do pedido (Cortex errou de plano).
const { soPipelineModelo } = require('../../scripts/cortex-fila');
test('PL1. soPipelineModelo: só o nexia-pipeline.yml não conta como entrega', () => {
  assert.equal(soPipelineModelo(['.github/workflows/nexia-pipeline.yml']), true);
  assert.equal(soPipelineModelo(['.github/workflows/nexia-pipeline.yml', 'scripts/x.js']), false);
  assert.equal(soPipelineModelo(['scripts/x.js']), false);
  assert.equal(soPipelineModelo([]), false);
});
