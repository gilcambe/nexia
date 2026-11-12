'use strict';
// #1967 (frente C): o endereço antigo nexia.gcbezerra.workers.dev leva as PÁGINAS para cortex.kernex.com.br.
// API, arquivos, /.well-known, /body-coach e o proxy do Body Coach (X-Nexia-Proxy) continuam iguais.
const test = require('node:test');
const assert = require('node:assert/strict');
const { redirecionarHostAntigo } = require('../../cloudflare/host-antigo');

const ANTIGO = 'https://nexia.gcbezerra.workers.dev';
const req = (url, { method = 'GET', accept = 'text/html,application/xhtml+xml', headers = {} } = {}) =>
  new Request(url, { method, headers: { Accept: accept, ...headers } });

test('HA1. página no host antigo → 302 (temporário na 1ª semana) para cortex.kernex.com.br com caminho e query', () => {
  const r = redirecionarHostAntigo(req(`${ANTIGO}/central?aba=ia`));
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('Location'), 'https://cortex.kernex.com.br/central?aba=ia');
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
  assert.equal(redirecionarHostAntigo(req(`${ANTIGO}/`, { method: 'HEAD' })).status, 302);
});

test('HA3. Kernex Finance (/prumo/) vai para o próprio domínio finance.kernex.com.br (login autorizado lá)', () => {
  assert.equal(redirecionarHostAntigo(req(`${ANTIGO}/prumo/`)).headers.get('Location'), 'https://finance.kernex.com.br/prumo/');
  assert.equal(redirecionarHostAntigo(req(`${ANTIGO}/prumo/carteira?x=1`)).headers.get('Location'), 'https://finance.kernex.com.br/prumo/carteira?x=1');
  assert.equal(redirecionarHostAntigo(req(`${ANTIGO}/prumo`)).headers.get('Location'), 'https://finance.kernex.com.br/prumo');
});

test('HA2. host novo, API, arquivos, well-known, body-coach, proxy e POST não redirecionam', () => {
  const nulos = [
    req('https://cortex.kernex.com.br/central'),
    req(`${ANTIGO}/api/agenda?site=studiolima`),
    req(`${ANTIGO}/api/x`, { method: 'POST' }),
    req(`${ANTIGO}/central`, { method: 'POST' }),
    req(`${ANTIGO}/cortex.webmanifest`),
    req(`${ANTIGO}/sw.js`),
    req(`${ANTIGO}/assets/app-1.js`),
    req(`${ANTIGO}/logo.png`),
    req(`${ANTIGO}/.well-known/assetlinks.json`),
    req(`${ANTIGO}/body-coach/`),
    req(`${ANTIGO}/nexia/robos`),
    req(`${ANTIGO}/functions/x`),
    req(`${ANTIGO}/central`, { headers: { 'X-Nexia-Proxy': '1' } }),
    req(`${ANTIGO}/central`, { accept: 'application/json' }),
  ];
  for (const r of nulos) assert.equal(redirecionarHostAntigo(r), null, `${r.method} ${r.url} ${r.headers.get('Accept')}`);
});
