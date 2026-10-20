'use strict';
const test = require('node:test');
const assert = require('node:assert');
const pv = require('../../scripts/pages-volta.js');

const dep = (id, created_on, status = 'success', environment = 'production') => ({ id, created_on, environment, latest_stage: { name: 'deploy', status } });

test('PV1. anterior = último deploy de produção que deu certo', () => {
  assert.strictEqual(pv.escolherAnterior([dep('a', '2026-10-01'), dep('b', '2026-10-03', 'failure'), dep('c', '2026-10-02'), dep('d', '2026-10-04', 'success', 'preview')]), 'c');
  assert.strictEqual(pv.escolherAnterior([]), '');
});

const resp = (status, body = {}) => ({ ok: status < 400, status, json: async () => body });

test('PV2. site no ar: não volta', async () => {
  const chamadas = [];
  const fetchImpl = async (u, i) => { chamadas.push([u, i && i.method]); return resp(200); };
  const r = await pv.conferir('nexiacortex', 'https://x.pages.dev/', 'old', { token: 't', conta: 'c', fetchImpl, dormir: async () => {} });
  assert.deepStrictEqual(r, { ok: true });
  assert.strictEqual(chamadas.length, 1);
});

test('PV3. site fora 3 vezes: chama o rollback do deploy anterior', async () => {
  const chamadas = [];
  const fetchImpl = async (u, i) => { chamadas.push([String(u), i && i.method]); return String(u).includes('api.cloudflare.com') ? resp(200, { success: true, result: {} }) : resp(503); };
  const r = await pv.conferir('nexiabodycoach', 'https://x.pages.dev/body-coach/', 'old1', { token: 't', conta: 'c', fetchImpl, dormir: async () => {} });
  assert.deepStrictEqual(r, { ok: false, voltou: true });
  const rb = chamadas.find(([u]) => u.includes('/rollback'));
  assert.ok(rb && rb[0].endsWith('/accounts/c/pages/projects/nexiabodycoach/deployments/old1/rollback') && rb[1] === 'POST');
  assert.strictEqual(chamadas.filter(([u]) => u.includes('pages.dev')).length, 3);
});

test('PV4. sem deploy anterior não chama rollback; sem token o script não faz nada', async () => {
  let api = 0;
  const fetchImpl = async (u) => { if (String(u).includes('api.cloudflare')) api++; return resp(500); };
  const r = await pv.conferir('p', 'https://x/', '', { token: 't', conta: 'c', fetchImpl, dormir: async () => {} });
  assert.strictEqual(r.voltou, false); assert.strictEqual(api, 0);
  const orig = console.log; console.log = () => {};
  try { assert.strictEqual(await pv.main(['antes', 'p'], {}), 0); } finally { console.log = orig; }
});
