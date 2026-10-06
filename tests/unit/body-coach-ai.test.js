'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { handler } = require('../../netlify/functions/body-coach-ai.js');

test('BCAI1. OPTIONS responde 204 e GET é recusado', async () => {
  assert.equal((await handler({ httpMethod: 'OPTIONS', headers: {} })).statusCode, 204);
  assert.equal((await handler({ httpMethod: 'GET', headers: {} })).statusCode, 405);
});

test('BCAI2. sem login não fala com a equipe', async () => {
  const r = await handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ message: 'oi' }) });
  assert.equal(r.statusCode, 401);
});
