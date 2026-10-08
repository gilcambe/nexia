'use strict';
// Issue #234: o Reviewer pede mudanças e a volta de correção do coder não pode derrubar a execução
// com ORCHESTRATOR_ERROR. Vault, Tool Gateway e modelo em memória; nada sai da máquina.
const test = require('node:test');
const assert = require('node:assert');
const { createOrchestrator } = require('../../nexia-ai/orchestrator');
const { AGENTS } = require('../../nexia-ai/orchestrator/agents');
const { SCHEMAS } = require('../../nexia-ai/vault/schemas');
const { validateEntity } = require('../../nexia-ai/vault/validate');
const { VaultError } = require('../../nexia-ai/vault/errors');

const TOOLS = ['vault.get', 'github.get_file', 'github.compare', 'github.create_branch', 'github.edit_files', 'github.commit_files', 'github.create_pr', 'github.get_checks'];

function fakeVault() {
  const exes = new Map();
  let n = 0;
  const Execution = {
    async create(ctx, data) { const record = { ...data, id: `exe_${++n}`, version: 1 }; exes.set(record.id, record); return { record, replayed: false }; },
    async get(ctx, id) { return { ...exes.get(id) }; },
    async list() { return [...exes.values()]; },
    async update(ctx, id, patch, { expectedVersion } = {}) {
      const cur = exes.get(id);
      if (expectedVersion !== undefined && expectedVersion !== cur.version) throw new VaultError('VERSION_CONFLICT', 'versão');
      const next = { ...cur, ...patch };
      const { id: _i, version: _v, ...data } = next;
      const { issues } = validateEntity(SCHEMAS.Execution, data, { refPattern: () => /^[a-z]+_[A-Za-z0-9_-]+$/ });
      if (issues.length) throw new VaultError('VALIDATION', `Execution inválida: ${issues.map(x => `${x.path} ${x.rule}`).join('; ')}`, { issues });
      next.version = cur.version + 1;
      exes.set(id, next);
      return { ...next };
    },
  };
  return {
    exes,
    Project: { get: async () => ({ id: 'prj_1', name: 'Body Coach', primary_repository_id: 'rep_1', autonomy_level: 3, qa_checks: [] }) },
    Repository: { get: async () => ({ id: 'rep_1', default_branch: 'main' }), list: async () => [{ id: 'rep_1', default_branch: 'main' }] },
    Environment: { list: async () => [] },
    ToolCall: { get: async () => null },
    Execution,
  };
}

function fakeGateway() {
  const branches = { main: { 'src/pages/Treino.jsx': 'export default function Treino() { return <main>Treino</main>; }\n' } };
  const commits = {};
  let seq = 0, pr = 0;
  const ok = result => ({ status: 'succeeded', result, tool_call: { id: `tcl_${++seq}` } });
  const fail = (code, message) => ({ status: 'failed', error: { code, message }, tool_call: { id: `tcl_${++seq}` } });
  return {
    branches,
    describe: () => TOOLS.map(name => ({ name, risk: 'low', description: name, input_schema: { type: 'object' } })),
    async invoke(ctx, { tool, input }) {
      if (tool === 'github.create_branch') { branches[input.branch] = { ...branches.main }; commits[input.branch] = []; return ok({ branch: input.branch, from: 'main' }); }
      if (tool === 'github.get_file') {
        const f = (branches[input.ref || 'main'] || {})[input.path];
        return f === undefined ? fail('NOT_FOUND', 'não existe') : ok({ path: input.path, content: f });
      }
      if (tool === 'github.commit_files' || tool === 'github.edit_files') {
        const b = branches[input.branch];
        for (const f of input.files || []) b[f.path] = f.content;
        for (const e of input.edits || []) b[e.path] = String(b[e.path] || '').replace(e.find, e.replace);
        commits[input.branch].push({ sha: `sha${++seq}`, message: input.message });
        return ok({ branch: input.branch, commit: `sha${seq}` });
      }
      if (tool === 'github.compare') {
        const b = branches[input.head] || {};
        const files = Object.keys(b).filter(p => b[p] !== branches.main[p]).map(path => ({ path, status: branches.main[path] === undefined ? 'added' : 'modified' }));
        return ok({ ahead_by: (commits[input.head] || []).length, commits: commits[input.head] || [], files });
      }
      if (tool === 'github.create_pr') return ok({ number: ++pr, html_url: `https://example.test/pr/${pr}` });
      if (tool === 'github.get_checks') return ok({ runs: [] });
      return ok({});
    },
  };
}

/** Router de teste: fila de respostas por agente; `failModels` simula um modelo grátis que quebra. */
function scriptedRouter(script, { failModels = [] } = {}) {
  const queues = Object.fromEntries(Object.entries(script).map(([k, v]) => [k, [...v]]));
  const seen = [];
  return {
    seen,
    capabilities: d => ({ available: d.provider === 'anthropic', tool_call: true }),
    costEstimate: () => ({ known: true, usd: 0 }),
    async chat(desc, req) { return this.toolCall(desc, { ...req, tools: [] }); },
    async toolCall(desc, req) {
      const agent = Object.keys(AGENTS).find(k => req.system.includes(AGENTS[k].prompt));
      seen.push({ agent, model: desc.model, goal: req.messages[0].content });
      const next = (queues[agent] || []).shift();
      if (!next) return { text: `${agent}: nada a fazer`, tool_calls: [], usage: {} };
      const r = typeof next === 'function' ? next(req, desc) : next;
      if (r instanceof Error) throw r;
      return { usage: {}, tool_calls: [], ...r };
    },
  };
}

let k = 0;
const resolver = async () => ({ project_id: 'prj_1', confidence: 1 });
const call = (name, input) => ({ id: `tc_${++k}`, name: name.replace(/\./g, '__'), input });
const branchOf = req => /Branch de trabalho: (\S+)/.exec(req.messages[0].content)[1];
const commitStep = (path, content) => req => ({ text: 'commit', tool_calls: [call('github.commit_files', { branch: branchOf(req), message: `Altera ${path}`, files: [{ path, content }] })] });
const LONG = 'DescansoTimer não está ligado na página de treino (src/pages/Treino.jsx): importe e renderize o componente depois da lista de séries. '.repeat(12);
const changes = () => ({ tool_calls: [call('report_findings', { verdict: 'changes_requested', findings: [
  { severity: 'high', file: 'src/pages/Treino.jsx', message: LONG },
  { severity: 'high', file: 'src/components/DescansoTimer.jsx', message: LONG },
  { severity: 'medium', file: 'src/components/AvatarCorpo.jsx', message: LONG },
] })] });
const approve = () => ({ tool_calls: [call('report_findings', { verdict: 'approve', findings: [] })] });
const ctx = { tenantId: 't1', executionId: 'exe-fix-loop-1', actor: { type: 'user', id: 'gilcambe' } };

async function runOnce(router) {
  const vault = fakeVault();
  const gw = fakeGateway();
  const o = createOrchestrator({ vault, gateway: gw, router, resolver, contextBuilder: async () => ({ text: 'Projeto Body Coach (React).' }), fetchImpl: async () => ({ status: 200 }) });
  const s = await o.start({ ...ctx, executionId: `exe-fix-${++k}` }, { message: 'Crie o DescansoTimer e ligue na página de treino src/pages/Treino.jsx', projectId: 'prj_1' });
  assert.ok(s.execution, JSON.stringify(s));
  return { exe: await o.run(ctx, s.execution.id), gw };
}



test('FL1. Issue #234: reviewer pede mudanças (achados longos) e o coder corrige na volta, sem ORCHESTRATOR_ERROR', async () => {
  const router = scriptedRouter({
    architect: [{ text: 'Criar src/components/DescansoTimer.jsx e ligar em src/pages/Treino.jsx.\nARQUIVOS: src/components/DescansoTimer.jsx, src/pages/Treino.jsx' }],
    frontend: [commitStep('src/components/DescansoTimer.jsx', 'export default function DescansoTimer() { return <p>60s</p>; }\n'), { text: 'feito' },
      commitStep('src/pages/Treino.jsx', 'import DescansoTimer from "../components/DescansoTimer";\nexport default function Treino() { return <main>Treino<DescansoTimer /></main>; }\n'), { text: 'corrigido' }],
    reviewer: [changes(), approve()], security: [approve()],
  });
  const { exe } = await runOnce(router);
  assert.notStrictEqual(exe.error_code, 'ORCHESTRATOR_ERROR', exe.result_summary);
  assert.deepStrictEqual([exe.review_verdict, exe.fix_rounds], ['approve', 1], exe.result_summary);
  assert.ok(exe.pull_request, 'PR aberto depois da correção');
});

test('FL2. rodadas repetidas: o coder volta até o limite e a 2ª correção começa por outro modelo grátis', async () => {
  const router = scriptedRouter({
    architect: [{ text: 'ARQUIVOS: src/pages/Treino.jsx' }],
    frontend: [commitStep('src/pages/Treino.jsx', 'v1\n'), { text: 'ok' }, commitStep('src/pages/Treino.jsx', 'v2\n'), { text: 'ok' }, commitStep('src/pages/Treino.jsx', 'v3\n'), { text: 'ok' }],
    reviewer: [changes(), changes(), changes()],
  });
  const { exe } = await runOnce(router);
  assert.deepStrictEqual([exe.status, exe.error_code, exe.fix_rounds], ['failed', 'REVIEW_CHANGES_REQUESTED', 2], exe.result_summary);
  assert.ok(exe.plan.every(s => !s.summary || s.summary.length <= 2000));
  const firstOfRound = router.seen.filter(s => s.agent === 'frontend').filter((s, i, a) => i === 0 || /RODADA DE CORREÇÃO/.test(s.goal) && !/RODADA DE CORREÇÃO/.test(a[i - 1].goal) || /RODADA DE CORREÇÃO 2/.test(s.goal) && !/RODADA DE CORREÇÃO 2/.test(a[i - 1].goal));
  const models = firstOfRound.map(s => s.model);
  assert.strictEqual(models.length, 3, JSON.stringify(models));
  assert.notStrictEqual(models[2], models[0], 'troca de modelo na rodada repetida');
});

test('FL3. erro interno sem código grava a causa na execução', async () => {
  const o = createOrchestrator({ vault: fakeVault(), gateway: fakeGateway(), router: scriptedRouter({}), resolver,
    contextBuilder: async () => { throw new TypeError('boom: x is undefined'); } });
  const s = await o.start({ ...ctx, executionId: 'exe-fl3' }, { message: 'Ligue o DescansoTimer em src/pages/Treino.jsx', projectId: 'prj_1' });
  const exe = await o.run(ctx, s.execution.id);
  assert.strictEqual(exe.error_code, 'ORCHESTRATOR_ERROR');
  assert.match(exe.result_summary, /boom: x is undefined/);
  assert.ok(exe.plan.some(p => p.status === 'failed' && /Erro: boom/.test(p.summary || '')));
});
