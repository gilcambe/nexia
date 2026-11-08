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

function bancoFalso() {
  const dados = new Map();
  const doc = (c, id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { dados.set(`${c}/${id}`, JSON.parse(JSON.stringify(v))); }, delete: async () => { dados.delete(`${c}/${id}`); }, get: async () => { const v = dados.get(`${c}/${id}`); return { exists: !!v, data: () => v && JSON.parse(JSON.stringify(v)) }; } });
  const col = (c) => ({ doc: (id) => doc(c, id), get: async () => ({ docs: [...dados.entries()].filter(([x]) => x.startsWith(c + '/') && !x.slice(c.length + 1).includes('/')).map(([x, v]) => ({ id: x.split('/').pop(), data: () => v })) }) });
  return { collection: col, dados };
}
const H = { authorization: 'Bearer t' };
async function comDados() {
  const db = bancoFalso();
  await db.collection('prumo_users').doc('pessoa-001').set({ plano: 'gratis', criado_em: '2026-11-01T00:00:00Z' });
  await db.collection('prumo_users').doc('pessoa-001').collection('config').doc('uso').set({ mes: '2026-11', leituras: 7 });
  await db.collection('prumo_users').doc('pessoa-001').collection('mensagens').doc('m1').set({ de: 'usuario', texto: 'Não leu minha fatura', status: 'aberta', em: '2026-11-08T10:00:00Z' });
  await db.collection('prumo_users').doc('pessoa-001').collection('lancamentos').doc('l1').set({ descricao: 'Mercado', valor: 312.9 });
  await db.collection('prumo_users').doc('pessoa-001').collection('carteira').doc('c1').set({ nome: 'CDB', valor: 4500 });
  return db;
}
const agora = () => Date.parse('2026-11-08T12:00:00Z');

test('PADM7. resumo do master traz só contagens: nenhum campo valor, nenhum lançamento ou carteira', async () => {
  const db = await comDados();
  const res = await createHandler({ getMw: () => masterMw, getDb: () => db, now: agora })({ httpMethod: 'GET', headers: H, queryStringParameters: { parte: 'resumo' } });
  assert.equal(res.statusCode, 200);
  const d = JSON.parse(res.body);
  assert.equal(d.total_pessoas, 1);
  assert.equal(d.leituras_mes, 7);
  assert.equal(d.mensagens_abertas, 1);
  assert.doesNotMatch(res.body, /"valor"|312|4500|Mercado|CDB/);
});

test('PADM8. usuário comum recebe 403 também no resumo e nas ações', async () => {
  const db = await comDados();
  const h = createHandler({ getMw: () => userMw, getDb: () => db, now: agora });
  assert.equal((await h({ httpMethod: 'GET', headers: H, queryStringParameters: { parte: 'resumo' } })).statusCode, 403);
  assert.equal((await h({ httpMethod: 'POST', headers: H, body: JSON.stringify({ acao: 'plano_definir', uid: 'pessoa-001', plano: 'pro' }) })).statusCode, 403);
});

test('PADM9. master muda o plano (com auditoria) e responde a mensagem', async () => {
  const db = await comDados();
  const h = createHandler({ getMw: () => masterMw, getDb: () => db, now: agora });
  let r = await h({ httpMethod: 'POST', headers: H, body: JSON.stringify({ acao: 'plano_definir', uid: 'pessoa-001', plano: 'pro' }) });
  assert.equal(r.statusCode, 200);
  assert.equal((await db.collection('prumo_users').doc('pessoa-001').get()).data().plano, 'pro');
  assert.ok([...db.dados.keys()].some((k) => k.includes('/auditoria/')));
  assert.equal((await h({ httpMethod: 'POST', headers: H, body: JSON.stringify({ acao: 'plano_definir', uid: 'pessoa-001', plano: 'ouro' }) })).statusCode, 400);
  r = await h({ httpMethod: 'POST', headers: H, body: JSON.stringify({ acao: 'mensagem_responder', uid: 'pessoa-001', texto: 'Mande de novo, já corrigimos.' }) });
  assert.equal(r.statusCode, 200);
  const m = JSON.parse((await h({ httpMethod: 'GET', headers: H, queryStringParameters: { parte: 'mensagens', uid: 'pessoa-001' } })).body).mensagens;
  assert.equal(m.length, 2);
  assert.equal(m.find((x) => x.de === 'usuario').status, 'respondida');
});

test('PADM10. JSON inválido responde 400', async () => {
  const res = await createHandler({ getMw: () => masterMw, getDb: () => bancoFalso() })({ httpMethod: 'POST', headers: H, body: '{x' });
  assert.equal(res.statusCode, 400);
});
