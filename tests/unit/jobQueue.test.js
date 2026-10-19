'use strict';
/**
 * tests/unit/jobQueue.test.js
 * Testes unitários para a fila de jobs com prioridade e orçamento diário.
 */

const test = require('node:test');
const assert = require('node:assert');
const { enqueue, dequeue, getQueueStatus, resetDailyQuota, CLASSES } = require('../../src/jobs/jobQueue');

test('JobQueue - Prioridade e Orçamento Diário', async () => {
  resetDailyQuota();

  // Enfileirar diferentes classes
  enqueue({ id: 'job-1', type: 'melhoria', payload: { task: 'melhoria visual' }, estimatedMinutes: 10 });
  enqueue({ id: 'job-2', type: 'producao', payload: { task: 'deploy critico' }, estimatedMinutes: 20 });
  enqueue({ id: 'job-3', type: 'cliente', payload: { task: 'suporte aluno' }, estimatedMinutes: 15 });

  const status = getQueueStatus();
  assert.strictEqual(status.total, 3, 'Deveria ter 3 jobs na fila');

  // Próximo deve ser producao (produção > cliente > melhoria) independentemente da ordem de inserção
  const next = dequeue();
  assert.ok(next, 'Deveria retornar um job');
  assert.strictEqual(next.type, 'producao', 'O primeiro job na fila deve ser de produção');
  assert.strictEqual(next.id, 'job-2');

  // Próximo deve ser cliente
  const nextClient = dequeue();
  assert.ok(nextClient);
  assert.strictEqual(nextClient.type, 'cliente');

  // Próximo deve ser melhoria
  const nextMelhoria = dequeue();
  assert.ok(nextMelhoria);
  assert.strictEqual(nextMelhoria.type, 'melhoria');
});

test('JobQueue - Respeita o orçamento diário por tipo', async () => {
  resetDailyQuota();

  // Limite de melhoria é 30 minutos
  enqueue({ id: 'melh-1', type: 'melhoria', estimatedMinutes: 25 });
  enqueue({ id: 'melh-2', type: 'melhoria', estimatedMinutes: 10 }); // 25 + 10 = 35 (> 30)

  const first = dequeue();
  assert.strictEqual(first.type, 'melhoria');
  assert.strictEqual(first.id, 'melh-1');

  // O segundo job excede o orçamento de melhoria (30 min), deve retornar objeto de erro de orçamento
  const second = dequeue();
  assert.ok(second.error, 'Deveria retornar erro de orçamento excedido');
  assert.strictEqual(second.jobClass, 'melhoria');
});
