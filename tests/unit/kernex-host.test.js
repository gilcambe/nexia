'use strict';
// #1180: bodycoach.kernex.com.br e cortex.kernex.com.br abrem o próprio app na raiz.
const test = require('node:test');
const assert = require('node:assert');
const { handleRequest } = require('../../cloudflare/app');

const ASSETS = { async fetch() { return new Response('SPA', { status: 200, headers: { 'Content-Type': 'text/html' } }); } };
const call = (url, init = {}) => handleRequest(new Request(url, init), { ASSETS }, { getFunction: () => null });

test('KX1. raiz de bodycoach.kernex.com.br vai para /body-coach/', async () => {
  const r = await call('https://bodycoach.kernex.com.br/?ref=ig');
  assert.strictEqual(r.status, 302);
  assert.strictEqual(r.headers.get('Location'), 'https://bodycoach.kernex.com.br/body-coach/?ref=ig');
});

test('KX2. raiz de cortex.kernex.com.br vai para /cortex', async () => {
  const r = await call('https://cortex.kernex.com.br/');
  assert.strictEqual(r.status, 302);
  assert.strictEqual(r.headers.get('Location'), 'https://cortex.kernex.com.br/cortex');
});

test('KX3. outros caminhos e outros domínios não mudam', async () => {
  for (const u of ['https://cortex.kernex.com.br/central', 'https://bodycoach.kernex.com.br/body-coach/', 'https://nexia.gcbezerra.workers.dev/']) {
    const r = await call(u);
    assert.strictEqual(r.status, 200, u);
  }
  const post = await call('https://cortex.kernex.com.br/', { method: 'POST' });
  assert.notStrictEqual(post.status, 302);
});
