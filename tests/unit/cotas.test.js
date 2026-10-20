'use strict';
const test = require('node:test');
const assert = require('node:assert');
const c = require('../../lib/cotas');

test('COT1. resumir calcula % e liga o freio só no que passou de 80%', () => {
  const r = c.resumir({ worker: 50000, ia: 8500, leituras: 1000 });
  const por = Object.fromEntries(r.itens.map((i) => [i.id, i]));
  assert.strictEqual(por.worker.pct, 50);
  assert.strictEqual(por.ia.pct, 85);
  assert.strictEqual(por.escritas.usado, null);
  assert.deepStrictEqual(r.perto, ['ia']);
  assert.strictEqual(r.frear, true);
  assert.strictEqual(c.deveFrear(r, 'ia'), true);
  assert.strictEqual(c.deveFrear(r, 'worker'), false);
  assert.strictEqual(c.resumir({}).frear, false);
});

const resp = (status, body) => ({ ok: status < 400, status, json: async () => body });

test('COT2. mede Worker e Workers AI pelo GraphQL do Cloudflare (uma consulta falhando não derruba a outra)', async () => {
  const fetchImpl = async (u, init) => {
    const q = JSON.parse(init.body).query;
    if (q.includes('workersInvocationsAdaptive')) return resp(200, { data: { viewer: { accounts: [{ workersInvocationsAdaptive: [{ sum: { requests: 700 } }, { sum: { requests: 300 } }] }] } } });
    return resp(200, { errors: [{ message: 'unknown field' }] });
  };
  const u = await c.medirCloudflare({ CLOUDFLARE_ANALYTICS_TOKEN: 't', CLOUDFLARE_ACCOUNT_ID: 'a' }, fetchImpl);
  assert.deepStrictEqual(u, { worker: 1000 });
  assert.deepStrictEqual(await c.medirCloudflare({}, fetchImpl), {});
});

test('COT3. Firestore pelo Cloud Monitoring; 403 vira "sem acesso"', async () => {
  const ok = async (u) => resp(200, { timeSeries: [{ points: [{ value: { int64Value: String(u).includes('read_count') ? '1200' : '30' } }] }] });
  const env = { FIREBASE_PROJECT_ID: 'p' };
  assert.deepStrictEqual(await c.medirFirestore(env, ok, Date.now(), async () => 'tok'), { leituras: 1200, escritas: 30 });
  assert.deepStrictEqual(await c.medirFirestore(env, async () => resp(403, {}), Date.now(), async () => 'tok'), { firestoreErro: 'sem acesso' });
  assert.deepStrictEqual(await c.medirFirestore({}, ok), {});
});

test('COT4. início do dia no Pacífico fica entre 0 e 24 h antes', () => {
  const agora = Date.UTC(2026, 9, 19, 15, 30, 0);
  const ini = Date.parse(c.inicioDiaPacifico(agora));
  assert.ok(agora - ini >= 0 && agora - ini < 24 * 3600e3);
  assert.strictEqual(new Date(ini).getUTCMinutes(), 0);
});

test('COT5. freio: sem token nunca freia; com IA a 90% freia e guarda por 10 min', async () => {
  c._resetMemo();
  assert.strictEqual(await c.freio({}, 'ia'), false);
  let chamadas = 0;
  const fetchImpl = async (u, init) => {
    chamadas++;
    const q = JSON.parse(init.body).query;
    if (q.includes('aiInferenceAdaptiveGroups')) return resp(200, { data: { viewer: { accounts: [{ aiInferenceAdaptiveGroups: [{ sum: { totalNeurons: 9000 } }] }] } } });
    return resp(200, { data: { viewer: { accounts: [{ workersInvocationsAdaptive: [] }] } } });
  };
  const env = { CLOUDFLARE_ANALYTICS_TOKEN: 't', CLOUDFLARE_ACCOUNT_ID: 'a' };
  assert.strictEqual(await c.freio(env, 'ia', { fetchImpl, agora: 1000 }), true);
  const n = chamadas;
  assert.strictEqual(await c.freio(env, 'ia', { fetchImpl, agora: 2000 }), true);
  assert.strictEqual(chamadas, n);
  c._resetMemo();
});

test('COT6. Central parte=cotas (só master) devolve os 4 itens', async () => {
  const { createHandler } = require('../../netlify/functions/central.js');
  const master = { verifyBearerToken: async () => ({ ok: true, role: 'master' }) };
  const r = await createHandler({ getMw: () => master, env: {}, fetch: async () => resp(500, {}) })({ httpMethod: 'GET', headers: {}, queryStringParameters: { parte: 'cotas' } });
  const b = JSON.parse(r.body);
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(b.itens.length, 4);
  assert.strictEqual(b.frear, false);
});
