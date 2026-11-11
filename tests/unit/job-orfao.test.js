'use strict';
// Tarefa da fila cuja execução já não existe: descarta sem falhar o NEXIA Jobs (não conta como falha do Cortex).
const test = require('node:test');
const assert = require('node:assert');
const { runJob, isOrfao } = require('../../nexia-ai/jobs/runner');

const JOB = { kind: 'execution.run', tenant: 'ces', actor: { type: 'user', id: 'uid-1' }, id: 'exe_' + 'b'.repeat(32) };
const naoExiste = () => Object.assign(new Error('Execution: registro não encontrado.'), { code: 'NOT_FOUND' });
const db = { collection() { throw new Error('não deveria ler o banco'); } };

test('JO1. execução inexistente → orphan_skipped, sem lançar erro', async () => {
  const r = await runJob(JOB, { db, vdb: db, vault: {}, orchestrator: { async run() { throw naoExiste(); } } });
  assert.deepStrictEqual(r, { kind: 'execution.run', id: JOB.id, status: 'orphan_skipped' });
});

test('JO2. outros erros continuam falhando (inclusive NOT_FOUND de outra entidade)', async () => {
  const outro = Object.assign(new Error('Project: registro não encontrado.'), { code: 'NOT_FOUND' });
  await assert.rejects(runJob(JOB, { db, vdb: db, vault: {}, orchestrator: { async run() { throw outro; } } }), /Project/);
  await assert.rejects(runJob(JOB, { db, vdb: db, vault: {}, orchestrator: { async run() { throw new Error('boom'); } } }), /boom/);
});

test('JO3. isOrfao só vale para tarefas de execução', () => {
  assert.strictEqual(isOrfao(JOB, naoExiste()), true);
  assert.strictEqual(isOrfao({ ...JOB, kind: 'project.onboard' }, naoExiste()), false);
  assert.strictEqual(isOrfao(JOB, null), false);
});
