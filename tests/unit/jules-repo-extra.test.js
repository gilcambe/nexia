'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { rodar, proximaExtra, reposExtras } = require('../../cloudflare/jules-auto.js');
const { mandarParaJules } = require('../../netlify/functions/central/pedidos-jules.js');

const AS_15 = Date.UTC(2026, 10, 8, 16, 0);
const nomes = (i) => (i.labels || []).map((l) => l.name || l);

function falso({ extra = [], extraStatus = 200, prsExtra = [] } = {}) {
  const chamadas = [];
  const fetchFn = async (url, init = {}) => {
    const u = String(url);
    chamadas.push({ url: u, method: init.method || 'GET', body: init.body });
    const res = (status, d) => ({ ok: status < 400, status, json: async () => d });
    if (u.includes('jules.googleapis.com')) return res(200, { id: 'S9' });
    if (u.includes('/repos/gilcambe/avaya-gsd/')) {
      if (extraStatus !== 200) return res(extraStatus, { message: 'Not Found' });
      if (/\/pulls\?/.test(u)) return res(200, prsExtra);
      if (/issues\?/.test(u)) return res(200, extra);
      const n = Number((/issues\/(\d+)$/.exec(u) || [])[1]);
      if (n) return res(200, extra.find(i => i.number === n));
      return res(200, {});
    }
    if (/\/pulls\?|issues\?/.test(u)) return res(200, []);
    return res(200, {});
  };
  return { fetchFn, chamadas };
}

test('EXTRA1: repo padrão do extra é gilcambe/avaya-gsd e aceita lista', () => {
  assert.deepStrictEqual(reposExtras({}), ['gilcambe/avaya-gsd']);
  assert.deepStrictEqual(reposExtras({ JULES_REPOS_EXTRA: 'a/b, c/d ,lixo' }), ['a/b', 'c/d']);
  assert.deepStrictEqual(reposExtras({ JULES_REPOS_EXTRA: '' }), []);
});

test('EXTRA2: escolhe a menor cortex-fila sem jules-enviado e sem PR', () => {
  const issues = [
    { number: 5, labels: ['cortex-fila'] },
    { number: 3, labels: ['cortex-fila', 'jules-enviado'] },
    { number: 4, labels: ['cortex-fila'] },
  ];
  assert.strictEqual(proximaExtra(issues, [{ title: 'x', body: 'Refs #4' }], nomes), 5);
  assert.strictEqual(proximaExtra(issues, [], nomes), 4);
  assert.strictEqual(proximaExtra([], [], nomes), null);
});

test('EXTRA3: envio vai para sources/github/gilcambe/avaya-gsd, base main, sem cortex-travado', async () => {
  const extra = [{ number: 3, state: 'open', title: 'voz', body: 'faça', labels: [{ name: 'cortex-fila' }] }];
  const { fetchFn, chamadas } = falso({ extra });
  const out = await rodar(AS_15, { env: { JULES_API_KEY: 'k', NEXIA_JOBS_TOKEN: 't' }, fetchFn });
  const jules = chamadas.filter(c => c.url.includes('jules.googleapis.com'));
  assert.strictEqual(jules.length, 1);
  const corpo = JSON.parse(jules[0].body);
  assert.strictEqual(corpo.sourceContext.source, 'sources/github/gilcambe/avaya-gsd');
  assert.strictEqual(corpo.sourceContext.githubRepoContext.startingBranch, 'main');
  assert.ok(!/develop/.test(corpo.prompt));
  const rot = chamadas.find(c => c.method === 'POST' && /avaya-gsd\/issues\/3\/labels/.test(c.url));
  assert.deepStrictEqual(JSON.parse(rot.body).labels, ['jules-enviado']);
  assert.strictEqual(out.extras[0].issue, 3);
});

test('EXTRA4: 404 no repo extra não derruba a rodada', async () => {
  const { fetchFn } = falso({ extraStatus: 404 });
  const out = await rodar(AS_15, { env: { JULES_API_KEY: 'k', NEXIA_JOBS_TOKEN: 't' }, fetchFn });
  assert.strictEqual(out.extras[0].repo, 'gilcambe/avaya-gsd');
  assert.ok(out.extras[0].erro || out.extras[0].enviados === 0 || out.extras[0].status);
});

test('EXTRA5: sem repo, mandarParaJules continua em gilcambe/nexia/develop', async () => {
  const chamadas = [];
  const p = { gh: async (c, init = {}) => { chamadas.push({ c, init }); return /issues\/7$/.test(c) ? { state: 'open', title: 't', labels: [] } : {}; } };
  const fetchFn = async (url, init) => { chamadas.push({ url, body: init.body }); return { ok: true, status: 200, json: async () => ({ id: 'S1' }) }; };
  await mandarParaJules(p, 7, 'teste', { env: { JULES_API_KEY: 'k' }, fetchFn });
  const corpo = JSON.parse(chamadas.find(x => x.url).body);
  assert.strictEqual(corpo.sourceContext.source, 'sources/github/gilcambe/nexia');
  assert.strictEqual(corpo.sourceContext.githubRepoContext.startingBranch, 'develop');
  assert.ok(chamadas.some(x => x.c === '/repos/gilcambe/nexia/issues/7'));
});
