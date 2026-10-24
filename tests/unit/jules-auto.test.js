'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { rodar } = require('../../cloudflare/jules-auto.js');

const AS_20 = Date.UTC(2026, 9, 24, 15, 21);
const env = { JULES_API_KEY: 'k', NEXIA_JOBS_TOKEN: 't' };

function falso(issues) {
  const chamadas = [];
  const fetchFn = async (url, init = {}) => {
    chamadas.push({ url: String(url), method: init.method || 'GET', body: init.body });
    const ok = (d) => ({ ok: true, status: 200, json: async () => d });
    if (String(url).includes('jules.googleapis.com')) return ok({ id: 'S1' });
    if (/labels=cortex-travado/.test(url)) return ok(issues);
    const n = Number((/issues\/(\d+)$/.exec(url) || [])[1]);
    if (n) return ok(issues.find(i => i.number === n));
    return ok({});
  };
  return { fetchFn, chamadas };
}

test('JULES-AUTO1: manda só a 1ª travada ainda não enviada, uma vez por hora', async () => {
  const issues = [
    { number: 1, state: 'open', title: 'já foi', labels: [{ name: 'cortex-travado' }, { name: 'jules-enviado' }] },
    { number: 2, state: 'open', title: 'pai dividido', labels: [{ name: 'cortex-travado' }, { name: 'cortex-dividido' }] },
    { number: 3, state: 'open', title: 'travada', body: 'faça x', labels: [{ name: 'cortex-travado' }] },
    { number: 4, state: 'open', title: 'outra', labels: [{ name: 'cortex-travado' }] },
  ];
  const f = falso(issues);
  const r = await rodar(AS_20, { env, fetchFn: f.fetchFn });
  assert.strictEqual(r.issue, 3);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(f.chamadas.filter(c => c.url.includes('jules.googleapis.com')).length, 1);
  const rot = f.chamadas.find(c => c.url.endsWith('/issues/3/labels'));
  assert.match(rot.body, /jules-enviado/);
});

test('JULES-AUTO2: fora da batida, sem chave ou desligado não faz nada', async () => {
  const f = falso([{ number: 3, state: 'open', labels: [{ name: 'cortex-travado' }] }]);
  assert.ok((await rodar(Date.UTC(2026, 9, 24, 15, 5), { env, fetchFn: f.fetchFn })).skipped);
  assert.ok((await rodar(AS_20, { env: { NEXIA_JOBS_TOKEN: 't' }, fetchFn: f.fetchFn })).skipped);
  assert.ok((await rodar(AS_20, { env: { ...env, JULES_AUTO: '0' }, fetchFn: f.fetchFn })).skipped);
  assert.strictEqual(f.chamadas.length, 0);
  const vazio = falso([]);
  assert.deepStrictEqual(await rodar(AS_20, { env, fetchFn: vazio.fetchFn }), { enviados: 0 });
});
