const test = require('node:test');
const assert = require('node:assert/strict');
const Orchestrator = require('../../nexia-ai/orchestrator/index.js');

test('modo_plano: true grava flag, executa apenas agent:analyze, define status waiting_approval e captura question', async () => {
  const stepsRun = [];
  const orchestrator = new Orchestrator({
    'agent:analyze': async () => {
      stepsRun.push('agent:analyze');
      return { plan: 'Plano detalhado de arquitetura' };
    },
    'create_branch': async () => { stepsRun.push('create_branch'); },
    'commit': async () => { stepsRun.push('commit'); },
    'create_pr': async () => { stepsRun.push('create_pr'); }
  });

  const ctx = { executionId: 'exec-plano-1' };
  const result = await orchestrator.start(ctx, {
    message: 'Refatorar orchestrator',
    projectId: 'proj-abc',
    modo_plano: true
  });

  assert.equal(result.modo_plano, true);
  assert.equal(result.status, 'waiting_approval');
  assert.equal(result.question, 'Plano detalhado de arquitetura');
  assert.deepEqual(stepsRun, ['agent:analyze']);
});

test('resume em waiting_approval com aprovacao executa passos de escrita subsequentes', async () => {
  const stepsRun = [];
  const orchestrator = new Orchestrator({
    'agent:analyze': async () => {
      stepsRun.push('agent:analyze');
      return { plan: 'Plano de teste' };
    },
    'create_branch': async () => { stepsRun.push('create_branch'); },
    'commit': async () => { stepsRun.push('commit'); },
    'create_pr': async () => { stepsRun.push('create_pr'); }
  });

  const ctx = { executionId: 'exec-resume-1' };
  await orchestrator.start(ctx, {
    message: 'Testar resume',
    projectId: 'proj-abc',
    modo_plano: true
  });
  assert.deepEqual(stepsRun, ['agent:analyze']);

  const resumed = await orchestrator.resume(ctx, {
    executionId: 'exec-resume-1',
    approved: true
  });

  assert.equal(resumed.status, 'completed');
  assert.deepEqual(stepsRun, ['agent:analyze', 'create_branch', 'commit', 'create_pr']);
});

test('modo_plano ausente ou false mantem o fluxo completo original sem pausar', async () => {
  const stepsRun = [];
  const orchestrator = new Orchestrator({
    'agent:analyze': async () => {
      stepsRun.push('agent:analyze');
      return { plan: 'Plano padrao' };
    },
    'create_branch': async () => { stepsRun.push('create_branch'); },
    'commit': async () => { stepsRun.push('commit'); },
    'create_pr': async () => { stepsRun.push('create_pr'); }
  });

  const ctx = { executionId: 'exec-padrao-1' };
  const result = await orchestrator.start(ctx, {
    message: 'Executar direto',
    projectId: 'proj-abc',
    modo_plano: false
  });

  assert.equal(result.modo_plano, false);
  assert.equal(result.status, 'completed');
  assert.deepEqual(stepsRun, ['agent:analyze', 'create_branch', 'commit', 'create_pr']);
});
