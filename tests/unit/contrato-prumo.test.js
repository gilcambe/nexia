// tests/unit/contrato-prumo.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

// importa a função handler do arquivo prumo.js
const { handler } = require('../../netlify/functions/prumo');

// Helper to mock request/response objects
function mockResponse() {
  const res = {};
  res.headers = {};
  res.statusCode = 200;
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.writeHead = (code, headers) => {
    res.statusCode = code;
    Object.assign(res.headers, headers);
  };
  res.end = (body) => { res.body = body; };
  return res;
}

// Caso comum: tela_dados recebe duas leituras e devolve seus resultados em paralelo
test('tela_dados - caso comum', async (t) => {
  const req = { method: 'POST', url: '/tela_dados', body: JSON.stringify({ leituras: [
    { acao: 'soma', params: { a: 2, b: 3 } },
    { acao: 'multiplica', params: { a: 4, b: 5 } }
  ] }) };
  const res = mockResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 200, 'Status deve ser 200');
  const payload = JSON.parse(res.body);
  assert.deepEqual(payload, { soma: 5, multiplica: 20 }, 'Deve retornar resultados corretos');
  assert.ok(res.headers['Server-Timing'], 'Header Server-Timing deve estar presente');
});

// Caso de borda: tela_dados com lista vazia retorna objeto vazio
test('tela_dados - borda lista vazia', async (t) => {
  const req = { method: 'POST', url: '/tela_dados', body: JSON.stringify({ leituras: [] }) };
  const res = mockResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.body);
  assert.deepEqual(payload, {}, 'Lista vazia deve resultar em objeto vazio');
  assert.ok(res.headers['Server-Timing']);
});

// Entrada inválida: falta o campo "leituras"
test('tela_dados - entrada inválida', async (t) => {
  const req = { method: 'POST', url: '/tela_dados', body: JSON.stringify({ outro: [] }) };
  const res = mockResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 400, 'Deve responder 400 para payload inválido');
  const payload = JSON.parse(res.body);
  assert.equal(payload.error, 'Payload inválido', 'Mensagem de erro esperada');
});

// Caso comum da rota /prumo_tempos (após algumas chamadas de tela_dados)
test('prumo_tempos - stats corretas', async (t) => {
  // gera algumas chamadas para preencher o buffer interno
  const dummyReq = { method: 'POST', url: '/tela_dados', body: JSON.stringify({ leituras: [{ acao: 'soma', params: { a: 1, b: 2 } }] }) };
  const dummyRes = mockResponse();
  for (let i = 0; i < 5; i++) await handler(dummyReq, dummyRes);

  const req = { method: 'GET', url: '/prumo_tempos' };
  const res = mockResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  const stats = JSON.parse(res.body);
  // deve conter média e pior caso para a ação "tela_dados"
  assert.ok(typeof stats.tela_dados === 'object', 'Stats deve ter chave tela_dados');
  assert.ok('media' in stats.tela_dados && 'piorCaso' in stats.tela_dados, 'media e piorCaso devem existir');
  assert.ok(stats.tela_dados.media >= 0 && stats.tela_dados.piorCaso >= 0, 'Valores numéricos não negativos');
});
