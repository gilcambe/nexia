'use strict';
// Cadastro de clientes SEM PR (11/11/2026): cliente novo existe só no banco (kernex_cadastros/<tipo>__<slug>).
const test = require('node:test');
const assert = require('node:assert/strict');
const { buscarCadastro, limparCache } = require('../../lib/cadastro-banco.js');
const { fakeDb } = require('../helpers/agenda-fake-db.js');
const { createHandler } = require('../../netlify/functions/locacao.js');

async function dbCom(docs) {
  const db = fakeDb();
  for (const [id, d] of Object.entries(docs)) await db.collection('kernex_cadastros').doc(id).set(d);
  return db;
}

test('CB1. arquivo continua tendo prioridade (clientes atuais não mudam)', async () => {
  limparCache();
  const db = await dbCom({ 'locacao__splash': { tipo: 'locacao', nome: 'NÃO USAR', config: {} } });
  const c = await buscarCadastro('locacao', 'splash', () => ({ splash: { nome: 'Do arquivo' } }), () => db);
  assert.equal(c.nome, 'Do arquivo');
});

test('CB2. cliente só no banco é encontrado', async () => {
  limparCache();
  const db = await dbCom({ 'locacao__espaco-novo': { tipo: 'locacao', nome: 'Espaço Novo', versao: 1, config: { nome: 'Espaço Novo' } } });
  const c = await buscarCadastro('locacao', 'espaco-novo', () => ({}), () => db);
  assert.equal(c.nome, 'Espaço Novo'); assert.equal(c.origem, 'banco');
});

test('CB3. inativo, de outro tipo ou slug inválido não vale', async () => {
  limparCache();
  const db = await dbCom({ 'locacao__parado': { tipo: 'locacao', nome: 'x', ativo: false }, 'locacao__trocado': { tipo: 'agenda', nome: 'x' } });
  assert.equal(await buscarCadastro('locacao', 'parado', () => ({}), () => db), undefined);
  assert.equal(await buscarCadastro('locacao', 'trocado', () => ({}), () => db), undefined);
  assert.equal(await buscarCadastro('locacao', '../x', () => ({}), () => db), undefined);
});

test('CB4. cache de 60 s evita ler o banco a cada pedido', async () => {
  limparCache();
  const db = await dbCom({ 'agenda__c1': { tipo: 'agenda', nome: 'C1' } });
  let leituras = 0; const dbConta = { collection: n => { const col = db.collection(n); return { doc: id => { const d = col.doc(id); return { get: async () => { leituras++; return d.get(); } }; } }; } };
  let t = 1000;
  await buscarCadastro('agenda', 'c1', () => ({}), () => dbConta, () => t);
  await buscarCadastro('agenda', 'c1', () => ({}), () => dbConta, () => t + 30000);
  assert.equal(leituras, 1);
  await buscarCadastro('agenda', 'c1', () => ({}), () => dbConta, () => t + 61000);
  assert.equal(leituras, 2);
});

test('CB5. API de locação responde para cliente cadastrado só no banco (sem PR)', async () => {
  limparCache();
  const db = await dbCom({ 'locacao__festa-teste': { tipo: 'locacao', nome: 'Festa Teste', versao: 1, config: { nome: 'Festa Teste', whatsapp: '5511999990000', unidades: [{ id: 'u1', nome: 'Unidade 1', endereco: 'x' }], extras: [], sinal: { tipo: 'percentual', valor: 30 }, pix: { chave: '', titular: '' }, prazo_horas: 48, antecedencia_dias: 0, dias_a_frente: 30 } } });
  const h = createHandler({ getDb: () => db, getMw: () => ({ verifyBearerToken: async () => ({ ok: false }) }) });
  const r = await h({ httpMethod: 'GET', headers: {}, queryStringParameters: { site: 'festa-teste' } });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(JSON.parse(r.body).nome, 'Festa Teste');
  const r404 = await h({ httpMethod: 'GET', headers: {}, queryStringParameters: { site: 'nao-existe-ninguem' } });
  assert.notEqual(r404.statusCode, 200);
});
