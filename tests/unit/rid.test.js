'use strict';
const test = require('node:test');
const assert = require('node:assert');
const rid = require('../../lib/rid');
const { handleRequest } = require('../../cloudflare/app');
const { createHandler } = require('../../netlify/functions/central.js');

function dbFalso() {
  const docs = new Map();
  const col = {
    doc: (id) => ({ set: async (d) => { docs.set(id, d); } }),
    orderBy: () => ({ limit: (n) => ({ get: async () => ({ docs: [...docs.values()].sort((a, b) => b.em - a.em).slice(0, n).map((d) => ({ data: () => d })) }) }) }),
  };
  return { docs, collection: () => col };
}

test('RID1. aceita X-Request-Id seguro e gera um novo se vier ruim', () => {
  assert.strictEqual(rid.ridDe('abc-12345'), 'abc-12345');
  assert.notStrictEqual(rid.ridDe('<script>'), '<script>');
  assert.match(rid.ridDe(''), /^[A-Za-z0-9-]{16,}$/);
  assert.notStrictEqual(rid.ridDe(null), rid.ridDe(null));
});

test('RID2. log JSON de 1 linha com o rid', () => {
  const orig = console.log; let saida = '';
  console.log = (l) => { saida = l; };
  try { rid.logJson('info', 'oi', { rid: 'r-12345678' }); } finally { console.log = orig; }
  const j = JSON.parse(saida);
  assert.strictEqual(j.rid, 'r-12345678'); assert.strictEqual(j.msg, 'oi'); assert.strictEqual(j.nivel, 'info');
});

test('RID3. guardarErro respeita o limite por hora e listarErros vem do mais novo', async () => {
  rid._resetJanela();
  const db = dbFalso();
  const t = Date.UTC(2026, 9, 19, 10, 0, 0);
  for (let i = 0; i < rid.LIMITE_HORA + 5; i++) await rid.guardarErro(db, { rid: 'r' + i + '-xxxxxxx', rota: '/api/x', codigo: 500 }, t + i);
  assert.strictEqual(db.docs.size, rid.LIMITE_HORA);
  const l = await rid.listarErros(db, 3);
  assert.strictEqual(l.length, 3);
  assert.ok(l[0].em > l[1].em);
  assert.strictEqual(await rid.guardarErro(null, {}), false);
  rid._resetJanela();
});

test('RID4. Worker devolve X-Request-Id e, no erro 500, rid no corpo e erro guardado', async () => {
  const guardados = [];
  const getFunction = () => ({ handler: async () => { throw new Error('quebrou'); } });
  const orig = console.error; console.error = () => {};
  let r;
  try {
    r = await handleRequest(new Request('https://nexia.test/api/central', { headers: { 'X-Request-Id': 'teste-rid-123' } }), {},
      { getFunction, guardarErro: async (env, item) => { guardados.push(item); return true; } });
  } finally { console.error = orig; }
  assert.strictEqual(r.status, 500);
  assert.strictEqual(r.headers.get('X-Request-Id'), 'teste-rid-123');
  assert.strictEqual((await r.json()).rid, 'teste-rid-123');
  assert.strictEqual(guardados.length, 1);
  assert.strictEqual(guardados[0].rota, '/api/central');
  const ok = await handleRequest(new Request('https://nexia.test/health'), {}, { getFunction: () => null });
  assert.ok(ok.headers.get('X-Request-Id'));
});

test('RID5. o rid chega na função como x-request-id', async () => {
  let visto = '';
  const getFunction = () => ({ handler: async (ev) => { visto = ev.headers['x-request-id']; return { statusCode: 200, body: '{}' }; } });
  const r = await handleRequest(new Request('https://nexia.test/api/central'), {}, { getFunction });
  assert.strictEqual(visto, r.headers.get('X-Request-Id'));
});

test('RID6. Central parte=erros lista os últimos erros (só master)', async () => {
  rid._resetJanela();
  const db = dbFalso();
  await rid.guardarErro(db, { rid: 'abc-12345678', rota: '/api/x', codigo: 502, msg: 'resposta 502' });
  const master = { verifyBearerToken: async () => ({ ok: true, role: 'master' }) };
  const r = await createHandler({ getMw: () => master, getHistoricoDb: () => db })({ httpMethod: 'GET', headers: {}, queryStringParameters: { parte: 'erros' } });
  const b = JSON.parse(r.body);
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(b.erros[0].rid, 'abc-12345678');
  rid._resetJanela();
});
