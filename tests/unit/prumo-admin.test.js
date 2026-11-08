'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler } = require('../../netlify/functions/prumo-admin.js');

const masterMw = { verifyBearerToken: async () => ({ ok: true, role: 'master', email: 'dono@nexia', uid: 'u-master' }) };
const userMw = { verifyBearerToken: async () => ({ ok: true, role: 'user', email: 'user@nexia', uid: 'u-normal' }) };
const adminMw = { verifyBearerToken: async () => ({ ok: true, role: 'admin', email: 'admin@nexia', uid: 'u-admin' }) };
const failMw = { verifyBearerToken: async () => ({ ok: false, reason: 'Token inválido' }) };

test('PADM1. OPTIONS responde 204 com headers de CORS', async () => {
  const handler = createHandler();
  const res = await handler({ httpMethod: 'OPTIONS' });
  assert.equal(res.statusCode, 204);
  assert.equal(res.headers['Access-Control-Allow-Origin'], '*');
});

test('PADM2. métodos não permitidos respondem 405', async () => {
  const handler = createHandler();
  const res = await handler({ httpMethod: 'DELETE' });
  assert.equal(res.statusCode, 405);
});

test('PADM3. sem header de autenticação responde 401', async () => {
  const handler = createHandler({ getMw: () => masterMw });
  const res = await handler({ httpMethod: 'GET', headers: {} });
  assert.equal(res.statusCode, 401);
  const data = JSON.parse(res.body);
  assert.match(data.error, /Entre com sua conta/);
});

test('PADM4. token inválido responde 401', async () => {
  const handler = createHandler({ getMw: () => failMw });
  const res = await handler({ httpMethod: 'GET', headers: { authorization: 'Bearer invalido' } });
  assert.equal(res.statusCode, 401);
});

test('PADM5. usuário comum (não-master) responde 403', async () => {
  const handler = createHandler({ getMw: () => userMw });
  const res = await handler({ httpMethod: 'GET', headers: { authorization: 'Bearer user-token' } });
  assert.equal(res.statusCode, 403);
  const data = JSON.parse(res.body);
  assert.match(data.error, /Só o administrador da KERNEX/);
});

test('PADM6. usuário admin (não-master) responde 403', async () => {
  const handler = createHandler({ getMw: () => adminMw });
  const res = await handler({ httpMethod: 'GET', headers: { authorization: 'Bearer admin-token' } });
  assert.equal(res.statusCode, 403);
  const data = JSON.parse(res.body);
  assert.match(data.error, /Só o administrador da KERNEX/);
});

test('PADM7. usuário master tem acesso permitido (GET)', async () => {
  const agora = 1762560000000;
  const handler = createHandler({ getMw: () => masterMw, now: () => agora });
  const res = await handler({ httpMethod: 'GET', headers: { authorization: 'Bearer master-token' } });
  assert.equal(res.statusCode, 200);
  const data = JSON.parse(res.body);
  assert.equal(data.ok, true);
  assert.equal(data.admin, true);
  assert.equal(data.servico, 'prumo-admin');
  assert.equal(data.em, new Date(agora).toISOString());
});

test('PADM8. usuário master POST executa ação com sucesso', async () => {
  const handler = createHandler({ getMw: () => masterMw });
  const res = await handler({
    httpMethod: 'POST',
    headers: { authorization: 'Bearer master-token' },
    body: JSON.stringify({ acao: 'status_geral' }),
  });
  assert.equal(res.statusCode, 200);
  const data = JSON.parse(res.body);
  assert.equal(data.ok, true);
  assert.equal(data.acao, 'status_geral');
});

test('PADM9. usuário master POST com JSON inválido responde 400', async () => {
  const handler = createHandler({ getMw: () => masterMw });
  const res = await handler({
    httpMethod: 'POST',
    headers: { authorization: 'Bearer master-token' },
    body: '{invalido',
  });
  assert.equal(res.statusCode, 400);
  const data = JSON.parse(res.body);
  assert.match(data.error, /Pedido inválido/);
});
