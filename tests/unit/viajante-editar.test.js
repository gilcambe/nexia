'use strict';

// Viajante Pro: a agência edita destinos (sem limite, com foto e vídeo) e o site lê o que foi salvo.
const test = require('node:test');
const assert = require('node:assert/strict');
const fake = require('../helpers/agenda-fake-db.js');
globalThis.__NEXIA_FIRESTORE_MOCK__ = fake.fakeDb ? fake.fakeDb() : fake();
const { handler } = require('../../netlify/functions/viajante-pro');

const chamar = (body, metodo = 'POST', q = {}) => handler({ httpMethod: metodo, headers: {}, body: body ? JSON.stringify(body) : '', queryStringParameters: { site: 'viajantepro', ...q } }, {});

test('salva destinos com foto e vídeo e o site lê de volta', async () => {
  const { token } = JSON.parse((await chamar({ acao: 'entrar', senha: 'ADMIN01' })).body);
  const png = 'data:image/png;base64,' + Buffer.from('foto-teste').toString('base64');
  const foto = JSON.parse((await chamar({ acao: 'foto-enviar', token, dados: png })).body);
  assert.ok(foto.url.includes('foto='));
  assert.equal((await chamar({ acao: 'foto-enviar', token, dados: 'nao-e-imagem' })).statusCode, 400);

  const img = await chamar(null, 'GET', { foto: foto.id });
  assert.equal(img.headers['Content-Type'], 'image/png');
  assert.equal(img.isBase64Encoded, true);

  const destinos = Array.from({ length: 120 }, (_, i) => ({ nome: 'Destino ' + i, categoria: 'Neve', imagem: foto.url, video: 'https://youtu.be/x' }));
  assert.equal((await chamar({ acao: 'site-salvar', token, conteudo: { destinos } })).statusCode, 200);
  const site = JSON.parse((await chamar(null, 'GET')).body);
  assert.equal(site.conteudo.destinos.length, 120);
  assert.equal(site.conteudo.destinos[0].video, 'https://youtu.be/x');

  assert.equal((await chamar({ acao: 'site-salvar', conteudo: { destinos } })).statusCode, 401);
});
