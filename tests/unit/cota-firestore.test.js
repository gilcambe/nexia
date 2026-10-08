'use strict';
// Cota grátis do Firestore (run 37735271158): retomada sem ler o banco principal e fallback grátis
// (Issue do GitHub) quando os dois bancos estão sem cota.
const test = require('node:test');
const assert = require('node:assert');
const { runJob } = require('../../nexia-ai/jobs/runner');
const { sweepAllTenants } = require('../../nexia-ai/jobs');
const pend = require('../../scripts/nexia-job-pendente');

const quota = () => Object.assign(new Error('RESOURCE_EXHAUSTED: Quota exceeded.'), { code: 8 });
const JOB = { kind: 'execution.run', tenant: 'ces', actor: { type: 'user', id: 'uid-1' }, id: 'exe_' + 'a'.repeat(32) };

function fakeDb(nome, execs = [], { tenantsQuota = false } = {}) {
  const lidas = [];
  return { nome, lidas, runTransaction: async () => {}, collection(c) {
    lidas.push(c);
    const q = { where: () => q, select: () => q, limit: () => q,
      get: async () => {
        if (c === 'tenants' && tenantsQuota) throw quota();
        return { docs: (c === 'vault_executions' ? execs : []).map(x => ({ id: x.id, data: () => x })) };
      } };
    return q;
  } };
}

test('CQ1. sweep com banco B não lê "tenants" no banco principal e só visita empresas com execução parada', async () => {
  const A = fakeDb('A', [], { tenantsQuota: true });
  const B = fakeDb('B', [{ tenant_id: 'ces', status: 'running' }, { tenant_id: 'ces' }, { tenant_id: 'x', deleted_at: 1 }, { tenant_id: 'Bad!' }]);
  const vistos = [];
  const orchestrator = { async sweep(ctx) { vistos.push(ctx.tenantId); return []; } };
  const r = await sweepAllTenants({ db: A, vdb: B, orchestrator });
  assert.deepStrictEqual(vistos, ['ces']);
  assert.strictEqual(r.tenants, 1);
  assert.ok(!A.lidas.includes('tenants'));
});

test('CQ2. os dois bancos sem cota: erro QUOTA_BOTH (o workflow guarda o pedido)', async () => {
  const A = fakeDb('A'), B = fakeDb('B');
  const orchestrator = () => ({ async run() { throw quota(); } });
  await assert.rejects(runJob(JOB, { db: A, vdb: B, orchestrator }), e => e.code === 'QUOTA_BOTH');
  await assert.rejects(runJob(JOB, { db: A, vdb: A, orchestrator }), e => e.code === 'QUOTA_BOTH');
});

function fakeApi(issues = []) {
  const calls = [];
  const api = async (method, path, body) => { calls.push({ method, path, body }); return method === 'GET' ? issues : {}; };
  return { api, calls };
}

test('CQ3. guardar cria uma Issue com o pedido validado e não duplica', async () => {
  const { api, calls } = fakeApi();
  assert.deepStrictEqual(await pend.guardar({ api, job: { ...JOB, extra: 'segredo' } }), { guardado: true });
  const post = calls.find(c => c.method === 'POST');
  assert.deepStrictEqual(post.body.labels, [pend.LABEL]);
  assert.ok(!post.body.body.includes('segredo'), 'só campos validados');
  assert.deepStrictEqual(pend.lerPedido(post.body.body), JOB);
  const dup = fakeApi([{ title: post.body.title }]);
  assert.deepStrictEqual(await pend.guardar({ api: dup.api, job: JOB }), { guardado: false, motivo: 'ja_existe' });
  assert.ok(!dup.calls.some(c => c.method === 'POST'));
});

test('CQ4. reenviar despacha o nexia-jobs só para Issues do bot, com mais de 60 min, e fecha a Issue', async () => {
  const agora = Date.parse('2026-10-08T12:00:00Z');
  const body = `x\n\n\`\`\`json\n${JSON.stringify(JOB)}\n\`\`\`\n`;
  const base = { labels: [{ name: pend.LABEL }], body, user: { login: 'github-actions[bot]' } };
  const issues = [
    { ...base, number: 1, created_at: '2026-10-08T10:00:00Z' },
    { ...base, number: 2, created_at: '2026-10-08T11:30:00Z' },                       // cedo demais
    { ...base, number: 3, created_at: '2026-10-08T10:00:00Z', user: { login: 'alguem' } }, // não é do bot
    { ...base, number: 4, created_at: '2026-10-08T10:00:00Z', body: '```json\n{"kind":"rm -rf"}\n```' }, // inválido
  ];
  const { api, calls } = fakeApi(issues);
  assert.deepStrictEqual(await pend.reenviar({ api, agora }), { reenviados: 1 });
  const d = calls.find(c => c.path.endsWith('/dispatches'));
  assert.deepStrictEqual(JSON.parse(d.body.inputs.job), JOB);
  assert.ok(calls.some(c => c.method === 'PATCH' && c.path === '/issues/1' && c.body.state === 'closed'));
});
