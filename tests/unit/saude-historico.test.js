'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMemoryDriver } = require('../../lib/firebase-lite/d1-backend');
const h = require('../../netlify/functions/central/saude-historico');
const { createHandler } = require('../../netlify/functions/central.js');

const HORA = 36e5;
const T0 = Date.UTC(2026, 9, 1, 0, 1); // 01/10/2026 00:01 UTC
const rotas = [{ id: 'a', nome: 'A', url: 'https://a/' }, { id: 'b', nome: 'B', url: 'https://b/' }];

test('SH1. 1 amostra por hora, guarda 30 dias e resume disponibilidade, quedas, tempo e erros', async () => {
  const driver = createMemoryDriver();
  const db = h.abrirBanco({}, { driver });
  // "b" cai nas horas 2-3 (sem resposta) e na 5 (500); "a" sempre no ar em 100 ms.
  const medir = (hr) => async (url) => (url.includes('a') ? { ok: true, codigo: 200, tempo: 100 }
    : hr === 2 || hr === 3 ? { ok: false, codigo: 0, tempo: 6000 } : hr === 5 ? { ok: false, codigo: 500, tempo: 50 } : { ok: true, codigo: 200, tempo: 300 });
  for (let hr = 0; hr < 8; hr++) await h.guardarAmostra(db, { at: T0 + hr * HORA, medir: medir(hr), rotas });
  assert.equal((await h.guardarAmostra(db, { at: T0 + 7 * HORA + 60000, medir: medir(0), rotas })).skipped, 'hora já medida');
  assert.equal(driver.docs.size, 8);

  const r = await h.resumo(db, { agora: T0 + 8 * HORA, rotas });
  assert.equal(r.amostras, 8);
  const [a, b] = r.rotas;
  assert.deepEqual([a.disponibilidade, a.quedas, a.erros, a.tempoMedio], [100, 0, 0, 100]);
  assert.deepEqual([b.disponibilidade, b.quedas, b.horasFora, b.erros, b.tempoMedio, b.agora], [62.5, 2, 3, 3, 300, false]);
  assert.deepEqual(b.codigos, { 'sem resposta': 2, 500: 1 });

  // 31 dias depois: a amostra nova entra e as antigas (mais de 30 dias) saem.
  await h.guardarAmostra(db, { at: T0 + 31 * 24 * HORA, medir: medir(0), rotas });
  assert.equal(driver.docs.size, 1);
});

test('SH2. Central: parte=historico só para o master e com banco vazio não quebra', async () => {
  const db = h.abrirBanco({}, { driver: createMemoryDriver() });
  const ev = { httpMethod: 'GET', headers: {}, queryStringParameters: { parte: 'historico' } };
  const master = { verifyBearerToken: async () => ({ ok: true, role: 'master' }) };
  const r = await createHandler({ getMw: () => master, getHistoricoDb: () => db })(ev);
  const b = JSON.parse(r.body);
  assert.equal(r.statusCode, 200);
  assert.equal(b.amostras, 0);
  assert.ok(b.rotas.some((x) => x.id === 'central') && b.rotas.every((x) => x.disponibilidade === null));
  const outro = { verifyBearerToken: async () => ({ ok: true, role: 'user' }) };
  assert.equal((await createHandler({ getMw: () => outro, getHistoricoDb: () => db })(ev)).statusCode, 403);
});
