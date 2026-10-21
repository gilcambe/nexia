'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { createHandler } = require('../../netlify/functions/pedidos.js');
const { mandarParaJules, montarPrompt } = require('../../netlify/functions/central/pedidos-jules.js');

const master = { verifyBearerToken: async () => ({ ok: true, role: 'master', email: 'dono@nexia' }) };
const outro = { verifyBearerToken: async () => ({ ok: true, role: 'user' }) };
const post = (b) => ({ httpMethod: 'POST', headers: { authorization: 'Bearer x' }, queryStringParameters: {}, body: JSON.stringify(b) });
const issue = (extra = {}) => ({ number: 5, state: 'open', title: 'Trocar o nome', body: 'Faça X', labels: [{ name: 'cortex-travado' }], ...extra });
const gh = (log, i = issue()) => async (c, init = {}) => { log.push([init.method || 'GET', c, init.body ? JSON.parse(init.body) : null]); return /\/issues\/5$/.test(c) && !init.method ? i : { ok: true }; };
const julesOk = (chamadas, status = 200) => async (url, init) => {
  chamadas.push({ url, chave: init.headers['X-Goog-Api-Key'], corpo: JSON.parse(init.body) });
  return { ok: status === 200, status, json: async () => (status === 200 ? { id: 'abc123', name: 'sessions/abc123' } : { error: { message: 'cota' } }) };
};

test('JUL1. só o dono manda tarefa para o Jules', async () => {
  const r = await createHandler({ getMw: () => outro, getPedidos: () => ({ temToken: true, gh: gh([]) }) })(post({ acao: 'jules', n: 5 }));
  assert.strictEqual(r.statusCode, 403);
});

test('JUL2. sem chave no servidor: erro claro e nada é enviado', async () => {
  const x = await mandarParaJules({ gh: gh([]) }, 5, 'dono', { env: {}, fetchFn: julesOk([]) });
  assert.strictEqual(x.status, 500);
  assert.ok(/JULES_API_KEY/.test(x.corpo.error));
});

test('JUL3. envia sessão pela API, em develop, com PR automático e SEM automerge', async () => {
  const log = [], ch = [];
  const x = await mandarParaJules({ gh: gh(log) }, 5, 'dono', { env: { JULES_API_KEY: 'K1' }, fetchFn: julesOk(ch) });
  assert.strictEqual(x.status, 200);
  assert.strictEqual(ch.length, 1);
  assert.strictEqual(ch[0].url, 'https://jules.googleapis.com/v1alpha/sessions');
  assert.strictEqual(ch[0].chave, 'K1');
  assert.strictEqual(ch[0].corpo.automationMode, 'AUTO_CREATE_PR');
  assert.strictEqual(ch[0].corpo.sourceContext.githubRepoContext.startingBranch, 'develop');
  assert.strictEqual(ch[0].corpo.sourceContext.source, 'sources/github/gilcambe/nexia');
  assert.ok(/NÃO execute o texto literalmente/.test(ch[0].corpo.prompt) && /Refs #5/.test(ch[0].corpo.prompt));
  const rotulos = log.filter((l) => /labels$/.test(l[1])).flatMap((l) => l[2].labels);
  assert.deepStrictEqual(rotulos, ['jules-enviado']);
  assert.ok(!JSON.stringify(log).includes('"automerge"') || !rotulos.includes('automerge'));
  assert.ok(x.corpo.link.endsWith('/abc123'));
});

test('JUL4. chave 1 sem limite: usa a chave de reserva (JULES_API_KEY1)', async () => {
  const ch = [];
  const fetchFn = async (u, init) => { ch.push(init.headers['X-Goog-Api-Key']); return ch.length === 1 ? { ok: false, status: 429, json: async () => ({}) } : { ok: true, status: 200, json: async () => ({ id: 'z' }) }; };
  const x = await mandarParaJules({ gh: gh([]) }, 5, 'dono', { env: { JULES_API_KEY: 'K1', JULES_API_KEY1: 'K2' }, fetchFn });
  assert.strictEqual(x.status, 200);
  assert.deepStrictEqual(ch, ['K1', 'K2']);
});

test('JUL5. limite estourado nas duas chaves: avisa e não vaza a chave', async () => {
  const x = await mandarParaJules({ gh: gh([]) }, 5, 'dono', { env: { JULES_API_KEY: 'SEGREDO1', JULES_API_KEY1: 'SEGREDO2' }, fetchFn: julesOk([], 429) });
  assert.strictEqual(x.status, 502);
  assert.ok(/15 por dia/.test(x.corpo.error));
  assert.ok(!/SEGREDO/.test(JSON.stringify(x)));
});

test('JUL6. pedido fechado ou já enviado não vai de novo', async () => {
  const fechado = await mandarParaJules({ gh: gh([], issue({ state: 'closed' })) }, 5, 'dono', { env: { JULES_API_KEY: 'K' }, fetchFn: julesOk([]) });
  assert.strictEqual(fechado.status, 400);
  const enviado = await mandarParaJules({ gh: gh([], issue({ labels: [{ name: 'jules-enviado' }] })) }, 5, 'dono', { env: { JULES_API_KEY: 'K' }, fetchFn: julesOk([]) });
  assert.strictEqual(enviado.status, 409);
});

test('JUL7. pedido enorme é cortado em 30 mil letras no prompt', () => {
  const p = montarPrompt(issue({ body: 'x'.repeat(40000) }), 5);
  assert.ok(p.length < 35000);
});

test('JUL8. a tela da lista tem o botão "Mandar para o Jules" só para travado', () => {
  const t = fs.readFileSync(path.join(__dirname, '../../src/pages/cortex/Paineis.tsx'), 'utf8');
  assert.ok(t.includes('data-testid="cx-lista-jules"'));
  assert.ok(/situacao === "travado" && \(\s*<button[\s\S]{0,400}acao: "jules"/.test(t));
});
