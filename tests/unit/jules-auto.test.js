'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { rodar, decidir } = require('../../cloudflare/jules-auto.js');

const AS_20 = Date.UTC(2026, 9, 24, 15, 31);
const env = { JULES_API_KEY: 'k', NEXIA_JOBS_TOKEN: 't' };

function falso(issues, prs = []) {
  const chamadas = [];
  const fetchFn = async (url, init = {}) => {
    chamadas.push({ url: String(url), method: init.method || 'GET', body: init.body });
    const ok = (d) => ({ ok: true, status: 200, json: async () => d });
    if (String(url).includes('jules.googleapis.com')) return ok({ id: 'S1' });
    if (/labels=cortex-travado/.test(url)) return ok(issues);
    if (/\/pulls\?/.test(url)) return ok(prs);
    const n = Number((/issues\/(\d+)$/.exec(url) || [])[1]);
    if (n) return ok(issues.find(i => i.number === n));
    return ok({});
  };
  return { fetchFn, chamadas };
}

test('JULES-AUTO1: manda só a 1ª travada ainda não enviada, uma por batida', async () => {
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
  assert.ok((await rodar(Date.UTC(2026, 9, 24, 15, 7), { env, fetchFn: f.fetchFn })).skipped);
  assert.ok((await rodar(AS_20, { env: { NEXIA_JOBS_TOKEN: 't' }, fetchFn: f.fetchFn })).skipped);
  assert.ok((await rodar(AS_20, { env: { ...env, JULES_AUTO: '0' }, fetchFn: f.fetchFn })).skipped);
  assert.strictEqual(f.chamadas.length, 0);
  const vazio = falso([]);
  assert.deepStrictEqual(await rodar(AS_20, { env, fetchFn: vazio.fetchFn }), { retomadas: [], reserva: [], humano: [], enviados: 0 });
});

const L = (...n) => n.map(name => ({ name }));
const nomes = i => (i.labels || []).map(l => l.name);
const H = 36e5;

test('JULES-AUTO3: escada: Jules sem PR no tempo volta ao Cortex do zero; 2ª vez vai para humano; com PR espera', () => {
  const agora = Date.UTC(2026, 9, 25, 12, 0);
  const velho = new Date(agora - 3 * H).toISOString(), novo = new Date(agora - 0.5 * H).toISOString();
  const issues = [
    { number: 10, labels: L('cortex-travado', 'jules-enviado'), updated_at: velho },
    { number: 11, labels: L('cortex-travado', 'jules-enviado', 'cortex-retomada'), updated_at: velho },
    { number: 12, labels: L('cortex-travado', 'jules-enviado'), updated_at: novo },
    { number: 13, labels: L('cortex-travado', 'jules-enviado'), updated_at: velho },
    { number: 14, labels: L('cortex-travado', 'so-humano', 'jules-enviado', 'cortex-retomada'), updated_at: velho },
    { number: 15, labels: L('cortex-travado', 'jules-enviado'), updated_at: velho },
    { number: 16, labels: L('cortex-travado', 'vez-do-claude', 'jules-enviado', 'cortex-retomada'), updated_at: velho },
    { number: 17, labels: L('cortex-travado', 'jules-enviado', 'cortex-retomada', 'reserva-tentou'), updated_at: velho },
  ];
  // PR recusado pelo revisor grátis conta como "sem PR": a #15 sobe de degrau.
  const prs = [{ title: 'fix', body: 'Refs #13' }, { title: 'outro', body: 'Refs #130' }, { title: 'x', body: 'Fecha #15', labels: L('revisor-recusou') }];
  const d = decidir(issues, prs, agora, nomes);
  // #1958: 2ª volta sem PR → IAs conectadas (reserva); reserva também sem PR → Claude.
  assert.deepStrictEqual(d, { enviar: null, retomar: [10, 15], reserva: [11], humano: [17], claude: [], devolver: [10, 11, 12, 15, 17] });
});

test('JULES-AUTO4: retomada tira travado, jules-enviado e tentativas e põe cortex-retomada', async () => {
  const velho = new Date(AS_20 - 30 * H).toISOString();
  const f = falso([{ number: 20, state: 'open', updated_at: velho, labels: L('cortex-fila', 'cortex-travado', 'jules-enviado', 'tentativa-12', 'sem-entrega-1') }]);
  const r = await rodar(AS_20, { env, fetchFn: f.fetchFn });
  assert.deepStrictEqual(r.retomadas, [20]);
  const apagados = f.chamadas.filter(c => c.method === 'DELETE').map(c => decodeURIComponent(c.url.split('/labels/')[1])).sort();
  assert.deepStrictEqual(apagados, ['cortex-travado', 'jules-enviado', 'sem-entrega-1', 'tentativa-12']);
  assert.ok(f.chamadas.some(c => c.url.endsWith('/issues/20/labels') && /cortex-retomada/.test(c.body)));
  assert.strictEqual(f.chamadas.filter(c => c.url.includes('jules.googleapis.com')).length, 0);
});

test('JULES-AUTO-PLANO: parte grande do plano (cortex-jules) vai antes das travadas', () => {
  const nomes = i => i.labels.map(l => l.name);
  const issues = [
    { number: 5, labels: [{ name: 'cortex-travado' }] },
    { number: 9, labels: [{ name: 'cortex-fila' }, { name: 'cortex-parte' }, { name: 'cortex-jules' }] },
  ];
  assert.equal(decidir(issues, [], Date.now(), nomes).enviar, 9);
});
