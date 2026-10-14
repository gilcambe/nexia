'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createHandler } = require('../../netlify/functions/central.js');

const master = { verifyBearerToken: async () => ({ ok: true, role: 'master', email: 'dono@nexia' }) };
const outro = { verifyBearerToken: async () => ({ ok: true, role: 'user' }) };
const ghFalso = (log = []) => ({
  cortex: async () => ({ naFila: 2, fazendo: [], travadas: [], feitas7: 3, ultimas: [], proximas: [] }),
  robos: async (l) => l.map((r) => ({ arquivo: r.arquivo, situacao: 'ok' })),
  divulga: async () => ({ naFila: 1, proximos: [], historico: [] }),
  rodar: async (a, i) => { log.push([a, i]); },
  pedirAoCortex: async (t) => { log.push(['pedir', t]); return { numero: 9, link: 'x' }; },
});
const ev = (o = {}) => ({ httpMethod: 'GET', headers: { authorization: 'Bearer x' }, queryStringParameters: {}, ...o });

test('CENT1. só o master abre a Central', async () => {
  const r = await createHandler({ getMw: () => outro })(ev());
  assert.strictEqual(r.statusCode, 403);
});

test('CENT2. lista de produtos e links sem nenhum segredo', async () => {
  const r = await createHandler({ getMw: () => master })(ev());
  const b = JSON.parse(r.body);
  assert.strictEqual(r.statusCode, 200);
  assert.ok(b.produtos.length >= 6 && b.links.length >= 5);
  assert.ok(!/token|secret|senha/i.test(r.body));
});

test('CENT3. saúde mede cada site (fora do ar = ok false)', async () => {
  const fetch = async (u) => { if (u.includes('bezsan')) throw new Error('fora'); return { status: 200 }; };
  const b = JSON.parse((await createHandler({ getMw: () => master, fetch })(ev({ queryStringParameters: { parte: 'saude' } }))).body);
  assert.strictEqual(b.produtos.find((p) => p.id === 'bezsan').ok, false);
  assert.strictEqual(b.produtos.find((p) => p.id === 'body-coach').ok, true);
});

test('CENT4. rodar só robôs da lista; ensaio do Divulga', async () => {
  const log = [];
  const h = createHandler({ getMw: () => master, getGithub: () => ghFalso(log) });
  const post = (b) => h(ev({ httpMethod: 'POST', body: JSON.stringify(b) }));
  assert.strictEqual((await post({ acao: 'rodar', arquivo: 'publicar-regras.yml' })).statusCode, 400);
  assert.strictEqual((await post({ acao: 'rodar', arquivo: 'divulga.yml', ensaio: true })).statusCode, 200);
  assert.deepStrictEqual(log[0], ['divulga.yml', { acao: 'ensaio' }]);
  assert.strictEqual((await post({ acao: 'pedir', texto: 'curto' })).statusCode, 400);
  assert.strictEqual((await post({ acao: 'pedir', texto: 'Criar botão de modo escuro na Central' })).statusCode, 200);
});

test('CENT5. dinheiro usa o resumo do Body Coach', async () => {
  const db = { collection: () => ({ orderBy: () => ({ limit: () => ({ get: async () => ({ docs: [{ data: () => ({ em: Date.now() }) }] }) }) }) }) };
  const h = createHandler({ getMw: () => master, getDb: () => db, getResumo: () => async () => ({ receitaMes: 50, pagantes: 2 }) });
  const b = JSON.parse((await h(ev({ queryStringParameters: { parte: 'dinheiro' } }))).body);
  assert.deepStrictEqual([b.receitaMes, b.pagantes, b.avisos7], [50, 2, 1]);
});

test('CENT6. uso do Cloudflare: sem token avisa, com token soma os pedidos do dia', async () => {
  const ev6 = ev({ queryStringParameters: { parte: 'cloudflare' } });
  const sem = JSON.parse((await createHandler({ getMw: () => master, env: {} })(ev6)).body);
  assert.strictEqual(sem.configurado, false);
  const fetch = async () => ({ ok: true, json: async () => ({ data: { viewer: { accounts: [{ workersInvocationsAdaptive: [{ sum: { requests: 1200 } }, { sum: { requests: 34 } }] }] } } }) });
  const com = JSON.parse((await createHandler({ getMw: () => master, env: { CLOUDFLARE_ANALYTICS_TOKEN: 't', NEXIA_D1_ACCOUNT_ID: 'c' }, fetch })(ev6)).body);
  assert.deepStrictEqual([com.configurado, com.pedidos, com.limite], [true, 1234, 100000]);
});
