'use strict';
// 22/11: 38 de 40 rodadas do NEXIA Jobs morreram no limite de 30 min do Actions. A varredura tem prazo:
// depois dele não começa execução nova e registra no log o que fez.
const test = require('node:test');
const assert = require('node:assert');
const { sweepAllTenants } = require('../../nexia-ai/jobs');

function vdb(n) {
  const docs = Array.from({ length: n }, (_, i) => ({ data: () => ({ tenant_id: `t${i}`, status: 'planned' }) }));
  return { collection: () => ({ where: () => ({ limit: () => ({ get: async () => ({ docs }) }) }) }) };
}

test('depois do prazo a varredura não visita mais empresas e avisa no log', async () => {
  let t = 0; const logs = []; const vistas = [];
  const orchestrator = { sweep: async (ctx, o) => { vistas.push(ctx.tenantId); t += 10 * 60 * 1000; return [{ id: `exe_${vistas.length}`, action: 'run', from: 'planned', to: 'succeeded' }]; } };
  const r = await sweepAllTenants({ vdb: vdb(5), orchestrator, deadline: 15 * 60 * 1000, now: () => t, log: (m) => logs.push(m) });
  assert.strictEqual(vistas.length, 2, vistas.join());
  assert.strictEqual(r.items.length, 2);
  assert.ok(logs.some((m) => /prazo de 15 min/.test(m)), logs.join('\n'));
  assert.ok(logs.some((m) => /exe_1 run: planned → succeeded/.test(m)), logs.join('\n'));
});

test('o orquestrador recebe o prazo e não começa execução depois dele', async () => {
  let recebido = null;
  const orchestrator = { sweep: async (ctx, o) => { recebido = o.deadline; return []; } };
  await sweepAllTenants({ vdb: vdb(1), orchestrator, deadline: 123456, now: () => 0, log: () => {} });
  assert.strictEqual(recebido, 123456);
});
