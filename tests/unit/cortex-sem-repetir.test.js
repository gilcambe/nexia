'use strict';
// 22/11: o Cortex refazia a mesma tarefa depois do merge (atualizaEstado juntado 9x, #4116–#4136). Execução nova
// cuja branch já teve PR juntado termina como "Já entregue", sem codar nem abrir outro PR.
const test = require('node:test');
const assert = require('node:assert');
const { createOrchestrator, workBranchFor } = require('../../nexia-ai/orchestrator');
const { SCHEMAS } = require('../../nexia-ai/vault/schemas');
const { validateEntity } = require('../../nexia-ai/vault/validate');

function fakeVault() {
  const exes = new Map(); let n = 0;
  return {
    Project: { get: async () => ({ id: 'prj_1', name: 'NEXIA', primary_repository_id: 'rep_1', autonomy_level: 3, qa_checks: [] }) },
    Repository: { get: async () => ({ id: 'rep_1', default_branch: 'main' }), list: async () => [{ id: 'rep_1', default_branch: 'main' }] },
    Environment: { list: async () => [] }, ToolCall: { get: async () => null },
    Execution: {
      async create(ctx, data) { const record = { ...data, id: `exe_${++n}`, version: 1 }; exes.set(record.id, record); return { record, replayed: false }; },
      async get(ctx, id) { return { ...exes.get(id) }; },
      async list() { return [...exes.values()]; },
      async update(ctx, id, patch) {
        const next = { ...exes.get(id), ...patch };
        const { id: _i, version: _v, ...data } = next;
        const { issues } = validateEntity(SCHEMAS.Execution, data, { refPattern: () => /^[a-z]+_[A-Za-z0-9_-]+$/ });
        if (issues.length) throw new Error(issues.map(x => `${x.path} ${x.rule}`).join('; '));
        next.version += 1; exes.set(id, next); return { ...next };
      },
    },
  };
}

function gateway(pulls) {
  const chamadas = [];
  const ok = (result) => ({ status: 'succeeded', result, tool_call: { id: `tcl_${chamadas.length}` } });
  return {
    chamadas,
    describe: () => ['github.list_pulls', 'github.create_branch', 'github.create_pr', 'github.compare', 'github.commit_files', 'github.get_file'].map(name => ({ name, risk: 'low', description: name, input_schema: { type: 'object' } })),
    async invoke(ctx, { tool, input }) {
      chamadas.push(tool);
      if (tool === 'github.list_pulls') return ok({ pulls: input.state === 'closed' ? pulls : [] });
      if (tool === 'github.create_branch') return ok({ branch: input.branch, from: 'main' });
      if (tool === 'github.compare') return ok({ ahead_by: 0, commits: [], files: [] });
      if (tool === 'github.create_pr') return ok({ number: 999, html_url: 'x' });
      return ok({});
    },
  };
}

const router = { capabilities: () => ({ available: true, tool_call: true }), costEstimate: () => ({ known: true, usd: 0 }),
  async chat() { return { text: 'ok', tool_calls: [], usage: {} }; }, async toolCall() { return { text: 'ARQUIVOS: scripts/x.js', tool_calls: [], usage: {} }; } };
const ctx = { tenantId: 't1', actor: { type: 'user', id: 'gilcambe' } };
const PEDIDO = 'Crie o script nexia-ai/cron/atualizaEstado.js que atualiza o estado';

async function rodar(pulls, { retomada = false } = {}) {
  const gw = gateway(pulls);
  const vault = fakeVault();
  const o = createOrchestrator({ vault, gateway: gw, router, resolver: async () => ({ project_id: 'prj_1', confidence: 1 }), contextBuilder: async () => ({ text: '' }), fetchImpl: async () => ({ status: 200 }) });
  const s = await o.start({ ...ctx, executionId: `exe-${Math.random()}` }, { message: PEDIDO, projectId: 'prj_1' });
  if (retomada) {
    // Execução ANTIGA retomada pela varredura (#4141): a branch já foi criada numa rodada anterior.
    const x = await vault.Execution.get(ctx, s.execution.id);
    const plan = x.plan.map(p => (p.action === 'create_branch' || p.action === 'agent:analyze' ? { ...p, status: 'done', attempts: 1 } : p));
    await vault.Execution.update(ctx, x.id, { plan, work_branch: workBranchFor(PEDIDO), status: 'planned' });
  }
  return { exe: await o.run(ctx, s.execution.id), gw };
}

test('tarefa com PR já juntado termina "Já entregue" sem codar nem abrir PR', async () => {
  const { exe, gw } = await rodar([{ number: 4136, head: workBranchFor(PEDIDO), merged_at: '2026-11-22T10:00:00Z', html_url: 'https://github.com/gilcambe/nexia/pull/4136' }]);
  assert.strictEqual(exe.status, 'succeeded', exe.result_summary);
  assert.match(exe.result_summary, /Já entregue: o PR #4136/);
  assert.strictEqual(exe.pull_request, 4136);
  assert.ok(!gw.chamadas.includes('github.create_branch') && !gw.chamadas.includes('github.create_pr'), gw.chamadas.join(','));
});

test('PR fechado SEM merge da mesma branch não bloqueia: a tarefa segue', async () => {
  const { gw } = await rodar([{ number: 10, head: workBranchFor(PEDIDO), merged_at: null, html_url: 'x' }]);
  assert.ok(gw.chamadas.includes('github.create_branch'), gw.chamadas.join(','));
});

test('#4141: execução ANTIGA retomada (branch já criada) com PR juntado também termina "Já entregue"', async () => {
  const { exe, gw } = await rodar([{ number: 4136, head: workBranchFor(PEDIDO), merged_at: '2026-11-22T17:10:00Z', html_url: 'u' }], { retomada: true });
  assert.strictEqual(exe.status, 'succeeded', exe.result_summary);
  assert.match(exe.result_summary, /Já entregue: o PR #4136/);
  assert.ok(!gw.chamadas.includes('github.create_pr') && !gw.chamadas.includes('github.commit_files'), gw.chamadas.join(','));
  assert.strictEqual(gw.chamadas.filter(c => c === 'github.list_pulls').length, 1, 'confere uma vez só por rodada');
});
