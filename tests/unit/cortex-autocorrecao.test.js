'use strict';
// Autocorreção da fila do Cortex: PR vazio não abre (#225), get_file sem ref e troca de modelo
// depois de 2 falhas seguidas (#221), cota do banco B esgotada cai no banco principal.
const test = require('node:test');
const assert = require('node:assert');
const { createGithubAdapter } = require('../../nexia-ai/github-adapter');
const { createFakeGithub } = require('../fake-github');
const { runAgent, createMeter } = require('../../nexia-ai/orchestrator/runtime');
const githubTools = require('../../nexia-ai/tool-gateway/tools/github');
const { runJob, isQuota } = require('../../nexia-ai/jobs/runner');

const REPO = { owner: 'gilcambe', repo: 'nexia', default_branch: 'develop' };

test('AC1. PR de branch sem mudanças é recusado com EMPTY_DIFF (nenhum POST /pulls)', async () => {
  const gh = createFakeGithub();
  const a = createGithubAdapter({ repo: REPO, env: gh.env, fetchImpl: gh.fetchImpl });
  await a.createBranch({ branch: 'nexia/vazia' });
  await assert.rejects(a.createPull({ head: 'nexia/vazia', title: 'nada' }), e => e.code === 'EMPTY_DIFF');
  assert.ok(!gh.calls.some(c => c.method === 'POST' && /\/pulls$/.test(c.path)), 'sem POST /pulls');
  await a.commitFiles({ branch: 'nexia/vazia', message: 'muda', files: [{ path: 'src/x.js', content: '1\n' }] });
  const pr = await a.createPull({ head: 'nexia/vazia', title: 'agora sim' });
  assert.ok(pr.number >= 1);
});

test('AC2. github.get_file com ref vazio usa a branch padrão (develop)', async () => {
  const t = githubTools.find(x => x.name === 'github.get_file');
  const seen = [];
  const repo = { id: 'r1', project_id: 'p1', provider: 'github', ...REPO };
  const deps = { vault: { Repository: { get: async () => repo } }, ctx: {}, project: { id: 'p1', primary_repository_id: 'r1' },
    github: () => ({ getFile: async i => { seen.push(i.ref); return { path: i.path, size: 1, content: 'x' }; } }) };
  for (const ref of ['', '   ', undefined]) await t.run(deps, { path: 'a.js', ...(ref === undefined ? {} : { ref }) });
  await t.run(deps, { path: 'a.js', ref: 'nexia/b' });
  assert.deepStrictEqual(seen, ['develop', 'develop', 'develop', 'nexia/b']);
});

test('AC3. mesmo modelo errando a mesma ferramenta 2 vezes seguidas troca já de provedor grátis', async () => {
  const providers = [];
  const call = () => ({ tool_calls: [{ id: `c${providers.length}`, name: 'github__get_file', input: { path: 'a.js', ref: '' } }], usage: {} });
  const router = {
    capabilities: d => ({ available: ['groq', 'cerebras'].includes(d.provider), tool_call: true }),
    async toolCall(desc) { providers.push(`${desc.provider}/${desc.model}`); return providers.length <= 3 ? call() : { text: 'fim', tool_calls: [], usage: {} }; },
  };
  const gateway = { describe: () => [{ name: 'github.get_file', risk: 'LOW', description: 'x', input_schema: { type: 'object' } }],
    async invoke() { return { tool_call: { id: 't' }, status: 'failed', error: { code: 'INVALID_INPUT', message: 'ref inválido' } }; } };
  const meter = createMeter({ max_steps: 50, max_tool_calls: 50, max_tokens: 1e9, max_ms: 60000 });
  await runAgent({ agentId: 'reviewer', goal: 'Revise', router, gateway, ctx: {}, projectId: 'p1', meter });
  assert.ok(providers.length >= 3, providers.join(','));
  assert.strictEqual(providers[0], providers[1], 'a 1ª falha não troca');
  assert.notStrictEqual(providers[2], providers[0], `troca depois da 2ª falha seguida (${providers.join(',')})`);
});

test('AC4. cota do banco B esgotada (RESOURCE_EXHAUSTED): a tarefa roda de novo no banco principal', async () => {
  assert.ok(isQuota(Object.assign(new Error('RESOURCE_EXHAUSTED: Quota exceeded.'), { code: 8 })));
  assert.ok(!isQuota(new Error('outra coisa')));
  const fake = nome => ({ nome, runTransaction: async () => {}, collection: () => ({}) });
  const A = fake('A'), B = fake('B');
  const usados = [];
  const orchestrator = ({ vdb }) => ({ async run() {
    usados.push(vdb.nome);
    if (vdb === B) throw Object.assign(new Error('RESOURCE_EXHAUSTED: Quota exceeded.'), { code: 8 });
    return { status: 'running' };
  } });
  const job = { kind: 'execution.run', tenant: 'ces', actor: { type: 'user', id: 'uid-1' }, id: 'exe_' + 'a'.repeat(32) };
  const r = await runJob(job, { db: A, vdb: B, orchestrator });
  assert.deepStrictEqual(usados, ['B', 'A']);
  assert.strictEqual(r.status, 'running');
  // Outro erro não troca de banco.
  const other = () => ({ async run() { throw new Error('quebrou'); } });
  await assert.rejects(runJob(job, { db: A, vdb: B, orchestrator: other }), /quebrou/);
});
