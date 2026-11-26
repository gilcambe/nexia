import { describe, it, mock } from 'node:test';
import assert from 'node:assert';

// Mock do Orchestrator e Gateway
const mockGateway = {
  create_branch: mock.fn(() => ({ ok: true })),
  commit_files: mock.fn(() => ({ ok: true })),
  edit_files: mock.fn(() => ({ ok: true })),
};

const orchestrator = {
  run: async (pedido, options, gateway) => {
    if (options.modo_plano) {
      return { status: 'waiting_approval', question: 'Plano: ...' };
    }
    await gateway.create_branch('test');
    await gateway.commit_files({ branch: 'test', message: 'feat', files: [] });
    return { status: 'completed' };
  },
  resume: async (runId, approval, gateway) => {
    if (approval) {
      await gateway.create_branch('test');
      await gateway.commit_files({ branch: 'test', message: 'feat', files: [] });
      return { status: 'completed' };
    }
  }
};

describe('Cortex Modo Plano', () => {
  it('deve pausar com modo_plano: true', async () => {
    const result = await orchestrator.run('fazer algo', { modo_plano: true }, mockGateway);
    assert.strictEqual(result.status, 'waiting_approval');
    assert.ok(result.question.includes('Plano'));
    assert.strictEqual(mockGateway.create_branch.mock.callCount(), 0);
    assert.strictEqual(mockGateway.commit_files.mock.callCount(), 0);
  });

  it('deve executar normalmente sem modo_plano', async () => {
    mockGateway.create_branch.mock.resetCalls();
    mockGateway.commit_files.mock.resetCalls();
    const result = await orchestrator.run('fazer algo', { modo_plano: false }, mockGateway);
    assert.strictEqual(result.status, 'completed');
    assert.strictEqual(mockGateway.create_branch.mock.callCount(), 1);
    assert.strictEqual(mockGateway.commit_files.mock.callCount(), 1);
  });

  it('deve continuar após aprovação', async () => {
    mockGateway.create_branch.mock.resetCalls();
    mockGateway.commit_files.mock.resetCalls();
    await orchestrator.resume('run-1', true, mockGateway);
    assert.strictEqual(mockGateway.create_branch.mock.callCount(), 1);
    assert.strictEqual(mockGateway.commit_files.mock.callCount(), 1);
  });
});
