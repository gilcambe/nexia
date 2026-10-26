'use strict';
// #1846: rotas das máquinas do dono (pulso, tarefa, resultado) com D1 em memória.
const test = require('node:test');
const assert = require('node:assert');
const { createMemoryDriver } = require('../../lib/firebase-lite/d1-backend');
const { createMaquinas } = require('../../nexia-ai/maquinas');

const TOKEN = 'x'.repeat(30);
const json = (event, statusCode, body) => ({ statusCode, body });
const ev = (path, method, body, token = TOKEN, q) => ({ path, httpMethod: method, body: body && JSON.stringify(body),
  headers: token ? { authorization: `Bearer ${token}` } : {}, queryStringParameters: q });
const novo = (env = { NEXIA_MAQUINA_TOKEN: TOKEN }) => createMaquinas({ env, driver: createMemoryDriver() });

test('MQ1. sem token configurado a rota não existe; token errado dá 401; outra rota passa adiante', async () => {
  assert.strictEqual((await novo({}).rotaDoPc(ev('/api/nexia/maquinas/pulso', 'POST', { nome: 'PC1' }), json)).statusCode, 404);
  const m = novo();
  assert.strictEqual((await m.rotaDoPc(ev('/api/nexia/maquinas/pulso', 'POST', { nome: 'PC1' }, 'y'.repeat(30)), json)).statusCode, 401);
  assert.strictEqual(await m.rotaDoPc(ev('/api/nexia/me', 'GET'), json), null);
  assert.strictEqual(await m.rotaDoPc(ev('/api/nexia/maquinas', 'GET'), json), null);
});

test('MQ2. pulso grava a máquina e ela aparece online', async () => {
  const m = novo();
  const r = await m.rotaDoPc(ev('/api/nexia/maquinas/pulso', 'POST', { nome: 'PC2', cpu: 'i5-3470', ramTotal: 16, ramLivre: 9, modelos: ['qwen2.5:3b'], ollamaOk: true }), json);
  assert.strictEqual(r.statusCode, 200);
  const [pc] = await m.listar();
  assert.strictEqual(pc.nome, 'PC2'); assert.strictEqual(pc.online, true); assert.deepStrictEqual(pc.modelos, ['qwen2.5:3b']);
});

test('MQ3. tarefa vai para uma máquina só, volta com resultado e conta no placar', async () => {
  const m = novo();
  await m.pulso('PC1', {});
  assert.strictEqual((await m.rotaDoPc(ev('/api/nexia/maquinas/tarefa', 'GET', null, TOKEN, { nome: 'PC1' }), json)).statusCode, 204);
  const id = await m.criarTarefa({ tipo: 'triagem', mensagens: [{ role: 'user', content: 'oi' }] });
  const t = await m.rotaDoPc(ev('/api/nexia/maquinas/tarefa', 'GET', null, TOKEN, { nome: 'PC1' }), json);
  assert.strictEqual(t.statusCode, 200); assert.strictEqual(t.body.id, id); assert.strictEqual(t.body.status, 'rodando');
  assert.strictEqual((await m.rotaDoPc(ev('/api/nexia/maquinas/tarefa', 'GET', null, TOKEN, { nome: 'PC2' }), json)).statusCode, 204);
  assert.strictEqual((await m.rotaDoPc(ev('/api/nexia/maquinas/resultado', 'POST', { nome: 'PC2', id, texto: 'x' }), json)).statusCode, 409);
  const r = await m.rotaDoPc(ev('/api/nexia/maquinas/resultado', 'POST', { nome: 'PC1', id, texto: 'bug', tokens: 3 }), json);
  assert.strictEqual(r.statusCode, 200);
  const [pc] = await m.listar();
  assert.strictEqual(pc.feitas, 1); assert.strictEqual(pc.tokens, 3);
});
