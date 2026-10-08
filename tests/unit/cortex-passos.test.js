'use strict';
// Menos MAX_STEPS/NO_CHANGES nos modelos grátis: get_file numa pasta devolve a listagem (antes era
// INVALID_INPUT repetido) e, perto do limite de passos sem nada gravado, o agente é avisado para gravar.
const test = require('node:test');
const assert = require('node:assert');
const { createGithubAdapter } = require('../../nexia-ai/github-adapter');
const { createFakeGithub } = require('../fake-github');
const { runAgent, createMeter } = require('../../nexia-ai/orchestrator/runtime');
const githubTools = require('../../nexia-ai/tool-gateway/tools/github');

const REPO = { owner: 'gilcambe', repo: 'nexia', default_branch: 'develop' };
const files = { 'README.md': '# x\n', 'apps/body-coach/package.json': '{}\n', 'apps/body-coach/src/App.tsx': 'x\n', 'apps/body-coach/src/lib/a.ts': 'a\n' };

test('PS1. github.get_file numa pasta devolve a listagem com dica, não erro', async () => {
  const gh = createFakeGithub({ files });
  const a = createGithubAdapter({ repo: REPO, env: gh.env, fetchImpl: gh.fetchImpl });
  for (const p of ['apps/body-coach', 'apps/body-coach/']) {
    const r = await a.getFile({ path: p.replace(/\/$/, '') });
    assert.strictEqual(r.type, 'dir');
    assert.strictEqual(r.path, 'apps/body-coach');
    assert.deepStrictEqual(r.entries.map(e => [e.name, e.type]).sort(), [['package.json', 'file'], ['src', 'dir']]);
    assert.match(r.hint, /github\.get_file/);
    assert.strictEqual(r.content, undefined);
  }
  // Arquivo continua igual; edit_files numa pasta é recusado com mensagem clara.
  assert.strictEqual((await a.getFile({ path: 'apps/body-coach/package.json' })).content, '{}\n');
  await a.createBranch({ branch: 'nexia/ps1' });
  await assert.rejects(a.editFiles({ branch: 'nexia/ps1', message: 'x', edits: [{ path: 'apps/body-coach', find: 'a', replace: 'b' }] }), e => e.code === 'INVALID_INPUT' && /pasta/.test(e.message));
  const t = githubTools.find(x => x.name === 'github.get_file');
  assert.match(t.summarizeOutput({ path: 'apps/body-coach', type: 'dir', entries: [{}, {}] }), /pasta, 2 entrada/);
});

test('PS2. perto do limite de passos sem gravar, o agente recebe o aviso para gravar o que tem', async () => {
  const seen = [];
  const router = {
    capabilities: () => ({ available: true, tool_call: true }),
    async toolCall(desc, req) {
      seen.push(req.messages[req.messages.length - 1].content);
      return { tool_calls: [{ id: `c${seen.length}`, name: 'github__get_file', input: { path: 'a.js' } }], usage: {} };
    },
  };
  const gateway = { describe: () => ['github.get_file', 'github.edit_files'].map(name => ({ name, risk: 'LOW', description: name, input_schema: { type: 'object' } })),
    async invoke() { return { tool_call: { id: 't' }, status: 'succeeded', result: { path: 'a.js', size: 1, content: 'x' } }; } };
  const meter = createMeter({ max_steps: 100, max_tool_calls: 100, max_tokens: 1e9, max_ms: 60000 });
  const r = await runAgent({ agentId: 'coder', goal: 'Mude a.js', branch: 'nexia/ps2', router, gateway, ctx: {}, projectId: 'p1', meter });
  assert.strictEqual(r.error_code, 'MAX_STEPS');
  const avisos = seen.map((m, k) => (/restam 2 passos/.test(String(m)) ? k : -1)).filter(k => k >= 0);
  assert.deepStrictEqual(avisos, [seen.length - 2], `aviso só no penúltimo passo (${seen.length} passos)`);
  assert.match(seen[seen.length - 2], /nexia\/ps2/);
});
