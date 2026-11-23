'use strict';
// 23/11: a rodada da 01h foi cancelada sem nenhum log: UMA execução passou dos 30 min do job. Com prazo, a execução
// pausa (volta a "planned", passo em "pending") e continua na próxima rodada — não falha nem morre no meio.
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
  async chat() { return { text: 'ok', tool_calls: [], usage: {} }; }, async toolCall() { await new Promise(r => setTimeout(r, atraso)); return { text: 'ARQUIVOS: scripts/x.js', tool_calls: [], usage: {} }; } };
let atraso = 0;
const ctx = { tenantId: 't1', actor: { type: 'user', id: 'gilcambe' } };
const PEDIDO = 'Crie o script scripts/relatorio.js que gera o relatório diário';

function montar() {
  const gw = gateway([]); const vault = fakeVault();
  const o = createOrchestrator({ vault, gateway: gw, router, resolver: async () => ({ project_id: 'prj_1', confidence: 1 }), contextBuilder: async () => ({ text: '' }), fetchImpl: async () => ({ status: 200 }) });
  return { o, gw, vault };
}

test('prazo já vencido: a execução pausa (planned, PAUSED_DEADLINE) sem gastar ferramenta nem falhar', async () => {
  const { o, gw } = montar(); atraso = 0;
  const s = await o.start({ ...ctx, executionId: 'exe-p1' }, { message: PEDIDO, projectId: 'prj_1' });
  const exe = await o.run(ctx, s.execution.id, { deadline: Date.now() - 1 });
  assert.deepStrictEqual([exe.status, exe.error_code], ['planned', 'PAUSED_DEADLINE'], exe.result_summary);
  assert.strictEqual(gw.chamadas.length, 0);
  assert.ok(exe.plan.every(p => p.status !== 'failed' && p.status !== 'running'));
});

test('prazo vence no meio do passo do agente: pausa, passo volta a pending, e a rodada seguinte continua', async () => {
  const { o } = montar(); atraso = 80;
  const s = await o.start({ ...ctx, executionId: 'exe-p2' }, { message: PEDIDO, projectId: 'prj_1' });
  const exe = await o.run(ctx, s.execution.id, { deadline: Date.now() + 40 });
  assert.deepStrictEqual([exe.status, exe.error_code], ['planned', 'PAUSED_DEADLINE'], exe.result_summary);
  assert.ok(exe.plan.some(p => p.status === 'pending'));
  atraso = 0;
  const depois = await o.run(ctx, s.execution.id);
  assert.notStrictEqual(depois.error_code, 'PAUSED_DEADLINE', depois.result_summary);
});
