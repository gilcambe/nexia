'use strict';
// ADR-F12-04: log do NEXIA Bridge no Vault, ponta a ponta: token criado pela API (admin),
// cliente de sincronização do Bridge lendo o log local e o handler gravando ToolCalls.
// Rodar com: npm run test:rules
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { createVault, createExecutionContext } = require('../../nexia-ai/vault');
const { createHandler } = require('../../nexia-ai/api');
const { createSync } = require('../../nexia-bridge/lib/sync');
const { createLog } = require('../../nexia-bridge/lib/log');
const { collectMetrics } = require('../../nexia-ai/observability');

const RUN = crypto.randomBytes(4).toString('hex');
const T = `brg-${RUN}`, OTHER = `brg2-${RUN}`;
let db, vault, ids = {}, handler;
const ctxOf = (t = T) => createExecutionContext({ tenantId: t, actor: { type: 'user', id: 'gilcambe' } });
const req = (method, p, { body, headers = {} } = {}) => handler({ httpMethod: method, path: p, headers, queryStringParameters: {}, body: body === undefined ? null : JSON.stringify(body) })
  .then(r => ({ status: r.statusCode, body: JSON.parse(r.body || '{}') }));
// O handler, visto pelo cliente do Bridge, como se fosse fetch
const fetchViaHandler = async (url, o) => {
  const r = await handler({ httpMethod: o.method, path: new URL(url).pathname, headers: Object.fromEntries(Object.entries(o.headers).map(([k, v]) => [k.toLowerCase(), v])), queryStringParameters: {}, body: o.body });
  return { ok: r.statusCode < 300, status: r.statusCode, json: async () => JSON.parse(r.body) };
};

test.before(async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'rode via `npm run test:rules` (emuladores)');
  ({ db } = require('../../netlify/functions/firebase-init'));
  vault = createVault({ db });
  for (const t of [T, OTHER]) await db.doc(`tenants/${t}`).set({ slug: t, name: t, plan: 'free' });
  const mk = async (t, e, d) => (await vault[e].create(ctxOf(t), d)).record.id;
  ids.client = await mk(T, 'Client', { name: 'Cliente', slug: 'cliente', status: 'active' });
  ids.project = await mk(T, 'Project', { client_id: ids.client, name: 'Site', slug: 'site', type: 'website', status: 'active' });
  const oc = await mk(OTHER, 'Client', { name: 'Outro', slug: 'outro', status: 'active' });
  ids.other = await mk(OTHER, 'Project', { client_id: oc, name: 'Outro', slug: 'outro', type: 'website', status: 'active' });
  handler = createHandler({ db, verify: async () => ({ ok: true, uid: 'gilcambe', role: 'admin', tenantSlug: T }) });
});

test('B1. token do Bridge: aparece uma vez, lista sem segredo, revogado deixa de valer', async () => {
  const c = await req('POST', '/api/nexia/bridge-tokens', { body: { label: 'Notebook do Gil' } });
  assert.strictEqual(c.status, 201, JSON.stringify(c.body));
  assert.match(c.body.token, /^nxb_[0-9a-f]{64}$/);
  const l = await req('GET', '/api/nexia/bridge-tokens');
  assert.ok(l.body.items.some(i => i.id === c.body.record.id && i.label === 'Notebook do Gil'));
  assert.ok(!JSON.stringify(l.body).includes(c.body.token.slice(4)), 'listagem nunca mostra o token');
  const raw = (await db.collection('bridge_tokens').where('tenant_id', '==', T).get()).docs.map(d => JSON.stringify(d.data())).join();
  assert.ok(!raw.includes(c.body.token.slice(4)), 'Firestore guarda só o hash');
  const auth = { authorization: `Bearer ${c.body.token}` };
  assert.strictEqual((await req('POST', '/api/nexia/bridge/events', { headers: auth, body: { events: [] } })).status, 200);
  assert.strictEqual((await req('DELETE', `/api/nexia/bridge-tokens/${c.body.record.id}`)).status, 200);
  assert.strictEqual((await req('POST', '/api/nexia/bridge/events', { headers: auth, body: { events: [] } })).status, 401);
  assert.strictEqual((await req('POST', '/api/nexia/bridge/events', { headers: { authorization: 'Bearer nxb_' + '0'.repeat(64) }, body: { events: [] } })).status, 401);
  assert.strictEqual((await req('POST', '/api/nexia/bridge/events', { body: { events: [] } })).status, 401);
});

test('B2. log local → Vault: ToolCalls por agente, reenvio sem duplicar, projeto de outro tenant recusado', async () => {
  const { body } = await req('POST', '/api/nexia/bridge-tokens', { body: { label: 'sync' } });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexia-bridge-sync-'));
  const log = createLog(dir);
  log.write({ agent: 'claude-code', tool: 'workspace_write', project_id: ids.project, path: 'src/app.js', status: 'ok', duration_ms: 12 });
  log.write({ agent: 'claude-code', tool: 'terminal_run', project_id: ids.project, command: 'npm test', cwd: '.', status: 'ok', exit_code: 1, class: 'test', duration_ms: 900 });
  log.write({ agent: 'claude-code', tool: 'workspace_write', project_id: ids.project, path: '.env', status: 'error', error_code: 'SENSITIVE_FILE', duration_ms: 1 });
  log.write({ agent: 'claude-code', tool: 'workspace_delete', project_id: ids.project, path: 'a.txt', status: 'confirmation_required', confirmation_id: 'x', duration_ms: 1 });
  log.write({ agent: 'claude-code', tool: 'workspace_read', project_id: ids.other, path: 'x', status: 'ok', duration_ms: 1 });
  let calls = 0;
  const sync = createSync({ stateDir: dir, logFile: log.file, url: 'http://127.0.0.1', token: body.token, fetchImpl: async (u, o) => { calls++; return fetchViaHandler(u, o); } });
  assert.deepStrictEqual(await sync.flush(), { sent: 5 });
  assert.deepStrictEqual(await sync.flush(), { sent: 0 }, 'nada novo, nada enviado');
  const tcs = (await vault.ToolCall.list(ctxOf(), { where: { project_id: ids.project }, limit: 50 })).filter(c => c.tool.startsWith('bridge.'));
  const by = Object.fromEntries(tcs.map(c => [`${c.tool}:${c.status}`, c]));
  assert.deepStrictEqual(Object.keys(by).sort(), ['bridge.terminal_run:failed', 'bridge.workspace_write:denied', 'bridge.workspace_write:succeeded']);
  assert.deepStrictEqual(by['bridge.workspace_write:succeeded'].requested_by, { type: 'agent', id: 'bridge:claude-code' });
  assert.deepStrictEqual([by['bridge.terminal_run:failed'].risk, by['bridge.terminal_run:failed'].output_summary], ['MEDIUM', 'exit 1 (test)']);
  assert.deepStrictEqual([by['bridge.workspace_write:denied'].decision, by['bridge.workspace_write:denied'].error_code], ['forbidden', 'SENSITIVE_FILE']);
  assert.strictEqual((await vault.ToolCall.list(ctxOf(OTHER), { where: { project_id: ids.other }, limit: 50 })).length, 0, 'projeto de outro tenant não recebe nada');
  // Reenvio do mesmo log (ponto perdido): idempotente
  fs.unlinkSync(path.join(dir, 'sync-state.json'));
  assert.deepStrictEqual(await sync.flush(), { sent: 5 });
  assert.strictEqual((await vault.ToolCall.list(ctxOf(), { where: { project_id: ids.project }, limit: 50 })).filter(c => c.tool.startsWith('bridge.')).length, 3);
  // Falha do servidor não avança o ponto
  log.write({ agent: 'claude-code', tool: 'git_status', project_id: ids.project, status: 'ok', duration_ms: 3 });
  const down = createSync({ stateDir: dir, logFile: log.file, url: 'http://127.0.0.1', token: body.token, fetchImpl: async () => ({ ok: false, status: 503 }) });
  assert.deepStrictEqual(await down.flush(), { sent: 0, error: 'HTTP 503' });
  assert.deepStrictEqual(await sync.flush(), { sent: 1 });
  const m = await collectMetrics({ vault, ctx: ctxOf(), projectId: ids.project });
  assert.strictEqual(m.tools['bridge.git_status'].succeeded, 1, 'aparece em /auditoria');
  assert.ok(calls >= 3);
});
