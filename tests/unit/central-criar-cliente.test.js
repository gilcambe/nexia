'use strict';
// Ponta a ponta: o dono cria um cliente pela Central (sem PR) -> a API do tipo já atende -> o código de 1º acesso funciona.
const test = require('node:test');
const assert = require('node:assert/strict');
const { fakeDb } = require('../helpers/agenda-fake-db.js');
const { limparCache } = require('../../lib/cadastro-banco.js');
const central = require('../../netlify/functions/central.js');
const locacao = require('../../netlify/functions/locacao.js');

const mw = role => ({ verifyBearerToken: async () => (role ? { ok: true, role, uid: 'u1', email: 'dono@kernex.com.br' } : { ok: false }) });
const post = (h, body) => h({ httpMethod: 'POST', headers: { authorization: 'Bearer x' }, body: JSON.stringify(body) }).then(r => ({ status: r.statusCode, json: JSON.parse(r.body) }));

test('CC1. dono cria cliente de locação; API atende na hora; código de 1º acesso cria a senha', async () => {
  limparCache();
  const db = fakeDb();
  const hc = central.createHandler({ getDb: () => db, getMw: () => mw('master'), getGithub: () => ({}) });
  const r = await post(hc, { acao: 'cliente-criar', tipo: 'locacao', slug: 'festa-boa', nome: 'Festa Boa', whatsapp: '5511999990000',
    config: { unidades: [{ id: 'u1', nome: 'Salão', endereco: 'x' }], extras: [], sinal: { tipo: 'percentual', valor: 30 }, pix: { chave: '', titular: '' }, prazo_horas: 48, antecedencia_dias: 0, dias_a_frente: 30 } });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.match(r.json.codigo, /^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
  const salvo = (await db.collection('kernex_cadastros').doc('locacao__festa-boa').get()).data();
  assert.ok(salvo.codigo_hash && !JSON.stringify(salvo).includes(r.json.codigo.replace('-', '')), 'no banco só o hash');

  const hl = locacao.createHandler({ getDb: () => db, getMw: () => mw(null) });
  const g = await hl({ httpMethod: 'GET', headers: {}, queryStringParameters: { site: 'festa-boa' } });
  assert.equal(g.statusCode, 200); assert.equal(JSON.parse(g.body).nome, 'Festa Boa');

  const pa = await hl({ httpMethod: 'POST', headers: { 'cf-connecting-ip': '10.0.0.1' }, body: JSON.stringify({ site: 'festa-boa', acao: 'primeiro-acesso', codigo: r.json.codigo, senha_nova: 'SenhaForte2026' }) });
  assert.equal(pa.statusCode, 200, pa.body);
  assert.ok(JSON.parse(pa.body).token);
});

test('CC2. não-dono não cria; duplicado e dados inválidos são recusados', async () => {
  limparCache();
  const db = fakeDb();
  const fora = central.createHandler({ getDb: () => db, getMw: () => mw('user'), getGithub: () => ({}) });
  assert.equal((await post(fora, { acao: 'cliente-criar', tipo: 'agenda', slug: 'abc', nome: 'Abc' })).status, 403);
  const hc = central.createHandler({ getDb: () => db, getMw: () => mw('master'), getGithub: () => ({}) });
  assert.equal((await post(hc, { acao: 'cliente-criar', tipo: 'agenda', slug: 'studiolima', nome: 'Duplicado' })).status, 409, 'já existe no arquivo');
  assert.equal((await post(hc, { acao: 'cliente-criar', tipo: 'xyz', slug: 'abc', nome: 'Abc' })).status, 400);
  assert.equal((await post(hc, { acao: 'cliente-criar', tipo: 'agenda', slug: 'A B', nome: 'Abc' })).status, 400);
  assert.equal((await post(hc, { acao: 'cliente-criar', tipo: 'agenda', slug: 'novo-1', nome: 'Novo' })).status, 201);
  assert.equal((await post(hc, { acao: 'cliente-criar', tipo: 'agenda', slug: 'novo-1', nome: 'Novo' })).status, 409, 'já existe no banco');
  const l = await post(hc, { acao: 'cliente-listar' });
  assert.equal(l.status, 200); assert.ok(l.json.clientes.some(c => c.slug === 'novo-1' && !('codigo_hash' in c)));
});
