const test = require('node:test');
const assert = require('node:assert');
const { JobQueue } = require('../../src/jobs/jobQueue.js');

test('JobQueue prioridade e orçamento', async () => {
  const jq = new JobQueue({ producaoLimit: 2, clienteLimit: 2, melhoriaLimit: 2 });

  jq.addJob({ id: 'm1', class: 'melhoria', title: 'Melhoria 1' });
  jq.addJob({ id: 'p1', class: 'producao', title: 'Produção 1' });
  jq.addJob({ id: 'c1', class: 'cliente', title: 'Cliente 1' });

  // Produção deve vir primeiro devido à prioridade (producao > cliente > melhoria)
  const first = jq.nextJob();
  assert.strictEqual(first.id, 'p1');

  const second = jq.nextJob();
  assert.strictEqual(second.id, 'c1');

  const third = jq.nextJob();
  assert.strictEqual(third.id, 'm1');

  // Testando status e limites
  const status = jq.getStatus();
  assert.strictEqual(status.classes.producao.usedToday, 1);
  assert.strictEqual(status.classes.cliente.usedToday, 1);
  assert.strictEqual(status.classes.melhoria.usedToday, 1);
  assert.strictEqual(status.pendingJobs, 0);
});
