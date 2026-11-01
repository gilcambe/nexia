'use strict';

// Viajante Pro: o viajante abre o app pelo link (sem senha) e conversa com a agência.
const test = require('node:test');
const assert = require('node:assert/strict');
const fake = require('../helpers/agenda-fake-db.js');
globalThis.__NEXIA_FIRESTORE_MOCK__ = fake.fakeDb ? fake.fakeDb() : fake();
const { handler } = require('../../netlify/functions/viajante-pro');

async function api(body) {
  const r = await handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify(body), queryStringParameters: { site: 'viajantepro' } }, {});
  return { status: r.statusCode, json: JSON.parse(r.body) };
}

test('viajante abre o app pelo link e conversa com a agência sem senha', async () => {
  const { json: { token } } = await api({ acao: 'entrar', senha: 'ADMIN01' });
  assert.ok(token);
  const criada = await api({ acao: 'viagem-criar', token, nome: 'Ana', destino: 'Lisboa', datas: { inicio: '2026-12-01', fim: '2026-12-10' } });
  assert.equal(criada.status, 200);
  const codigo = criada.json.link.split('v=')[1];

  const app = await api({ acao: 'app-viagem', v: codigo });
  assert.equal(app.status, 200);
  assert.equal(app.json.viagem.destino, 'Lisboa');
  assert.equal((await api({ acao: 'app-viagem', v: 'codigo-errado' })).status, 404);

  const m1 = await api({ acao: 'app-chat-enviar', codigo, texto: 'Oi, sou a Ana' });
  assert.equal(m1.status, 200);
  assert.equal(m1.json.mensagem.autor, 'viajante');
  assert.equal((await api({ acao: 'chat-enviar', token, v: criada.json.id, texto: 'Oi Ana!' })).status, 200);

  const todas = await api({ acao: 'app-chat-listar', codigo });
  assert.deepEqual(todas.json.mensagens.map(m => m.autor), ['viajante', 'agencia']);
  const novas = await api({ acao: 'app-chat-listar', codigo, desde: m1.json.mensagem.id });
  assert.deepEqual(novas.json.mensagens.map(m => m.texto), ['Oi Ana!']);

  const conv = await api({ acao: 'chat-conversas', token });
  assert.equal(conv.json.conversas[0].naoLidas, 1);
  // sem senha não lê as conversas pelo id da viagem
  assert.equal((await api({ acao: 'chat-listar', v: criada.json.id })).status, 401);
});
