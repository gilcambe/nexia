'use strict';

const { enqueue, dequeue, getQueueStatus, resetDailyQuota } = require('./jobQueue');

function testJobQueue() {
  resetDailyQuota();
  
  // Enfileirar diferentes classes
  enqueue({ id: 'job-1', type: 'melhoria', payload: { task: 'melhoria visual' } });
  enqueue({ id: 'job-2', type: 'producao', payload: { task: 'deploy critico' } });
  enqueue({ id: 'job-3', type: 'cliente', payload: { task: 'suporte aluno' } });

  const status = getQueueStatus();
  if (status.total !== 3) throw new Error('Deveria ter 3 jobs na fila');

  // Próximo deve ser producao (produção > cliente > melhoria)
  const next = dequeue();
  if (!next || next.type !== 'producao') throw new Error('O primeiro job na fila deve ser de produção');

  console.log('[JobQueue Test] Todos os testes passaram com sucesso.');
}

if (require.main === module) {
  testJobQueue();
}

module.exports = { testJobQueue };
