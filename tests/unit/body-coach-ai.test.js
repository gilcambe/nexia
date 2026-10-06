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

test('BCAI3. foto vai como image_url só para provedor com visão (google)', async () => {
  const { createRouter } = require('../../nexia-ai/model-router');
  let enviado;
  const fetchImpl = async (url, init) => { enviado = JSON.parse(init.body); return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }], usage: {} }), text: async () => '' }; };
  const r = createRouter({ env: { GEMINI_API_KEY: 'x', GROQ_API_KEY: 'y' }, fetchImpl });
  const imgs = [{ mime: 'image/jpeg', data: 'QUJD' }];
  assert.equal(r.capabilities({ provider: 'google', model: 'gemini-2.5-flash' }).vision, true);
  assert.equal(r.capabilities({ provider: 'groq', model: 'openai/gpt-oss-120b' }).vision, false);
  await r.chat({ provider: 'google', model: 'gemini-2.5-flash' }, { messages: [{ role: 'user', content: 'analise' }], images: imgs });
  const u = enviado.messages.find(m => m.role === 'user');
  assert.equal(u.content[1].image_url.url, 'data:image/jpeg;base64,QUJD');
});
