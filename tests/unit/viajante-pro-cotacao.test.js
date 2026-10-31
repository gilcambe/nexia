'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { handler } = require('../../netlify/functions/viajante-pro');

// Mock do banco de dados Firestore
globalThis.__NEXIA_FIRESTORE_MOCK__ = {
  collection: function(col) {
    return {
      doc: function(id) {
        return {
          get: async function() {
            return { exists: true, data: () => ({ senha_hash: 'mock', senha_salt: 'mock' }) };
          },
          set: async function() { return {}; },
          update: async function() { return {}; },
          collection: function(sub) {
            return {
              doc: function(subId) {
                return {
                  get: async function() { return { exists: true, data: () => ({ expira_em: new Date(Date.now() + 86400000).toISOString() }) }; },
                  set: async function() { return {}; },
                  update: async function() { return {}; }
                };
              },
              get: async function() {
                return [
                  { data: () => ({ id: '123', codigo: 'VP-12345678', nome: 'Cliente Teste', status: 'Nova' }) }
                ];
              }
            };
          }
        };
      }
    };
  }
};

test('Viajante Pro Backend — Ação solicitar_cotacao', async () => {
  const event = {
    httpMethod: 'POST',
    body: JSON.stringify({
      acao: 'solicitar_cotacao',
      nome: 'Gildivan Teste',
      email: 'gildivan@teste.com',
      whatsapp: '11999999999',
      destino: 'Ilhas Maldivas',
      orcamento: 'R$ 10.000 a R$ 20.000 por pessoa',
      consentimento: true
    })
  };

  const response = await handler(event, {});
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body);
  assert.equal(body.ok, true);
  assert.match(body.codigo, /^VP-[A-Z0-9]+$/);
});

test('Viajante Pro Backend — Falha de Validação na Cotação', async () => {
  const event = {
    httpMethod: 'POST',
    body: JSON.stringify({
      acao: 'solicitar_cotacao',
      nome: 'Incompleto',
      consentimento: false
    })
  };

  const response = await handler(event, {});
  assert.equal(response.statusCode, 400);

  const body = JSON.parse(response.body);
  assert.equal(body.ok, undefined);
  assert.ok(body.error.length > 0);
});
