'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createHandler } = require('../../netlify/functions/pedidos.js');

const master = { verifyBearerToken: async () => ({ ok: true, role: 'master', email: 'dono@nexia' }) };
const outro = { verifyBearerToken: async () => ({ ok: true, role: 'user' }) };
const ev = (o = {}) => ({ httpMethod: 'GET', headers: { authorization: 'Bearer x' }, queryStringParameters: {}, ...o });
const post = (b) => ev({ httpMethod: 'POST', body: JSON.stringify(b) });
const falso = (log, resp = {}) => ({ temToken: true, lista: async (o) => ({ total: 0, itens: [], o }), detalhe: async (n) => ({ numero: Number(n) }),
  gh: async (c, i = {}) => { log.push([i.method || 'GET', c, i.body ? JSON.parse(i.body) : null]); return resp[c] || { number: 7 }; } });

test('PED1. só o dono abre o Cortex no celular', async () => {
  const r = await createHandler({ getMw: () => outro, getPedidos: () => falso([]) })(ev());
  assert.strictEqual(r.statusCode, 403);
});

test('PED2. pedir cria issue cortex-fila com as regras do projeto', async () => {
  const log = [];
  const r = await createHandler({ getMw: () => master, getPedidos: () => falso(log) })(post({ acao: 'pedir', texto: 'Colocar botão de WhatsApp no site' }));
  assert.strictEqual(r.statusCode, 200);
  const [m, c, b] = log[0];
  assert.strictEqual(m, 'POST'); assert.ok(c.endsWith('/issues'));
  assert.deepStrictEqual(b.labels, ['cortex-fila']); assert.ok(/tudo grátis/.test(b.body));
});

test('PED3. pedido curto ou grande demais é recusado', async () => {
  const h = createHandler({ getMw: () => master, getPedidos: () => falso([]) });
  assert.strictEqual((await h(post({ acao: 'pedir', texto: 'oi' }))).statusCode, 400);
  assert.strictEqual((await h(post({ acao: 'pedir', texto: 'x'.repeat(3600) }))).statusCode, 400);
});

test('PED4. tentar de novo tira travado e tentativas', async () => {
  const log = [];
  const resp = { '/repos/gilcambe/nexia/issues/5': { labels: [{ name: 'cortex-fila' }, { name: 'cortex-travado' }, { name: 'tentativa-11' }] } };
  await createHandler({ getMw: () => master, getPedidos: () => falso(log, resp) })(post({ acao: 'tentar', n: 5 }));
  const apagados = log.filter((l) => l[0] === 'DELETE').map((l) => l[1]);
  assert.ok(apagados.some((c) => c.endsWith('cortex-travado')) && apagados.some((c) => c.endsWith('tentativa-11')));
  assert.ok(!apagados.some((c) => c.endsWith('cortex-fila')));
});

test('PED5. aprovar PR só vale para ramo nexia/', async () => {
  const resp = { '/repos/gilcambe/nexia/pulls/9': { number: 9, state: 'open', head: { ref: 'dono/x' } } };
  const r = await createHandler({ getMw: () => master, getPedidos: () => falso([], resp) })(post({ acao: 'juntar', pr: 9 }));
  assert.strictEqual(r.statusCode, 400);
});
