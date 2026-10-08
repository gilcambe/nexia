'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler, cleanLead, COLLECTION } = require('../../netlify/functions/leads.js');

function fakeDb() {
  const docs = new Map();
  let n = 0;
  const col = {
    add: async (d) => { const id = 'L' + (++n); docs.set(id, { ...d }); return { id }; },
    orderBy: () => ({ limit: () => ({ get: async () => ({ docs: [...docs].reverse().map(([id, d]) => ({ id, data: () => d })) }) }) }),
    doc: (id) => ({ update: async (p) => docs.set(id, { ...docs.get(id), ...p }), delete: async () => docs.delete(id) }),
  };
  return { docs, collection: (name) => { assert.equal(name, COLLECTION); return col; } };
}
const mw = role => ({ verifyBearerToken: async (e) => (e.headers.authorization ? { ok: true, uid: 'u1', role } : { ok: false }) });
const post = (body, ip = '1.1.1.1') => ({ httpMethod: 'POST', headers: { 'cf-connecting-ip': ip, origin: 'https://clinica.pages.dev' }, body: JSON.stringify(body) });
const valido = { nome: 'Ana Souza', whatsapp: '(11) 98888-7777', consentimento: true, produto: 'Body-Coach', utm: { source: 'instagram', campaign: 'beta', x: 'ignorado' } };

test('LEAD1. lead válido é gravado limpo, com origem e site; resposta libera qualquer domínio', async () => {
  const db = fakeDb();
  const h = createHandler({ getDb: () => db, getMw: () => mw('user'), env: {} });
  const r = await h(post(valido, '9.9.9.1'));
  assert.equal(r.statusCode, 201);
  assert.equal(r.headers['Access-Control-Allow-Origin'], '*');
  const d = db.docs.get('L1');
  assert.equal(d.whatsapp, '11988887777');
  assert.equal(d.produto, 'body-coach');
  assert.equal(d.site, 'clinica.pages.dev');
  assert.equal(d.status, 'novo');
  assert.deepEqual(d.utm, { source: 'instagram', campaign: 'beta' });
});

test('LEAD2. validação: nome, contato, consentimento LGPD, e-mail e WhatsApp', () => {
  assert.match(cleanLead({ ...valido, nome: 'A' }).error, /nome/);
  assert.match(cleanLead({ nome: 'Ana', consentimento: true }).error, /WhatsApp ou e-mail/);
  assert.match(cleanLead({ ...valido, consentimento: 'sim' }).error, /LGPD/);
  assert.match(cleanLead({ ...valido, whatsapp: '', email: 'x@' }).error, /E-mail/);
  assert.match(cleanLead({ ...valido, whatsapp: '123' }).error, /WhatsApp/);
  assert.ok(cleanLead({ ...valido, whatsapp: '', email: 'ana@exemplo.com' }).lead);
});

test('LEAD3. robô que preenche o campo escondido recebe 200 e nada é gravado; IP com muitos envios leva 429', async () => {
  const db = fakeDb();
  const h = createHandler({ getDb: () => db, getMw: () => mw('user'), env: {} });
  assert.equal((await h(post({ ...valido, site_url: 'http://spam' }, '9.9.9.2'))).statusCode, 200);
  assert.equal(db.docs.size, 0);
  const codes = [];
  for (let i = 0; i < 7; i++) codes.push((await h(post(valido, '9.9.9.3'))).statusCode);
  assert.deepEqual(codes, [201, 201, 201, 201, 201, 429, 429]);
});

test('LEAD4. painel: sem login 401, usuário comum 403, admin lista, muda status e apaga', async () => {
  const db = fakeDb();
  await createHandler({ getDb: () => db, getMw: () => mw('user'), env: {} })(post(valido, '9.9.9.4'));
  const anon = createHandler({ getDb: () => db, getMw: () => mw('user') });
  assert.equal((await anon({ httpMethod: 'GET', headers: {} })).statusCode, 401);
  assert.equal((await anon({ httpMethod: 'GET', headers: { authorization: 'Bearer x' } })).statusCode, 403);
  const adm = createHandler({ getDb: () => db, getMw: () => mw('admin') });
  const auth = { authorization: 'Bearer x' };
  const list = JSON.parse((await adm({ httpMethod: 'GET', headers: auth })).body);
  assert.equal(list.items.length, 1);
  assert.equal((await adm({ httpMethod: 'PATCH', headers: auth, body: JSON.stringify({ id: 'L1', status: 'inventado' }) })).statusCode, 400);
  assert.equal((await adm({ httpMethod: 'PATCH', headers: auth, body: JSON.stringify({ id: 'L1', status: 'cliente', nota: 'fechou' }) })).statusCode, 200);
  assert.equal(db.docs.get('L1').status, 'cliente');
  assert.equal((await adm({ httpMethod: 'DELETE', headers: auth, body: JSON.stringify({ id: 'L1' }) })).statusCode, 200);
  assert.equal(db.docs.size, 0);
});

test('LEAD5. com BREVO_API_KEY e LEADS_NOTIFY_EMAIL manda aviso por e-mail; sem elas não chama nada', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok: true }; };
  const sem = createHandler({ getDb: () => fakeDb(), getMw: () => mw('user'), env: {}, fetchImpl });
  await sem(post(valido, '9.9.9.5'));
  assert.equal(calls.length, 0);
  const com = createHandler({ getDb: () => fakeDb(), getMw: () => mw('user'), env: { BREVO_API_KEY: 'k', LEADS_NOTIFY_EMAIL: 'dono@exemplo.com' }, fetchImpl });
  await com(post(valido, '9.9.9.6'));
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /brevo/);
  assert.match(calls[0].body.textContent, /wa\.me\/5511988887777/);
});
