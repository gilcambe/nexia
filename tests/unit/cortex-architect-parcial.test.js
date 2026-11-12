'use strict';
// #3354 (F2): o Architect não reprova a execução por limite de passos. Ao bater no limite, devolve o
// plano parcial que já escreveu (status done, parcial: true) e o pipeline segue. Só falha sem plano nenhum.
const test = require('node:test');
const assert = require('node:assert');
const { runAgent, createMeter } = require('../../nexia-ai/orchestrator/runtime');
const { AGENTS } = require('../../nexia-ai/orchestrator/agents');

const gateway = {
  describe: () => [{ name: 'github.get_file', risk: 'LOW', description: 'ler', input_schema: { type: 'object' } }],
  async invoke() { return { tool_call: { id: 't' }, status: 'succeeded', result: { path: 'a.js', size: 1, content: 'x' } }; },
};
const meter = () => createMeter({ max_steps: 200, max_tool_calls: 200, max_tokens: 1e9, max_ms: 60000 });
const routerQueSoLe = texto => {
  let n = 0;
  return {
    capabilities: () => ({ available: true, tool_call: true }),
    async toolCall() { n++; return { text: texto ? `${texto} (passo ${n})` : '', tool_calls: [{ id: `c${n}`, name: 'github__get_file', input: { path: 'a.js' } }], usage: {} }; },
  };
};

test('AP1. Architect tem o mesmo limite de passos do Coder (16)', () => {
  assert.strictEqual(AGENTS.architect.max_steps, 16);
  assert.strictEqual(AGENTS.architect.max_steps, AGENTS.coder.max_steps);
});

test('AP2. Architect no limite de passos com plano escrito devolve o plano parcial e não falha', async () => {
  const r = await runAgent({ agentId: 'architect', goal: 'Analise a.js', router: routerQueSoLe('PLANO: mudar a.js'), gateway, ctx: {}, projectId: 'p1', meter: meter() });
  assert.strictEqual(r.status, 'done');
  assert.strictEqual(r.parcial, true);
  assert.match(r.text, /PLANO: mudar a\.js/);
  assert.match(r.text, /parcial/i);
});

test('AP3. Architect no limite sem plano nenhum continua falhando com MAX_STEPS', async () => {
  const r = await runAgent({ agentId: 'architect', goal: 'Analise a.js', router: routerQueSoLe(''), gateway, ctx: {}, projectId: 'p1', meter: meter() });
  assert.strictEqual(r.status, 'failed');
  assert.strictEqual(r.error_code, 'MAX_STEPS');
});
