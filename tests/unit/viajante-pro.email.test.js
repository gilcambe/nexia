'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const gravados = [];

// Mock do banco de dados Firestore (igual padrão do projeto, com gravação para inspeção)
globalThis.__NEXIA_FIRESTORE_MOCK__ = {
  collection: function(col) {
    return {
      doc: function(id) {
        return {
          get: async function() {
            return { exists: true, data: () => ({ senha_hash: 'mock', senha_salt: 'mock' }) };
          },
          set: async function(data) {
            gravados.push({ col, id, data });
            return {};
          },
          update: async function() { return {}; },
          collection: function(sub) {
            return {
              doc: function(subId) {
                return {
                  get: async function() {
                    return { exists: true, data: () => ({ expira_em: new Date(Date.now() + 86400000).toISOString() }) };
                  },
                  set: async function(data) {
                    gravados.push({ col, sub, doc: subId, data });
                    return {};
                  },
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
      },
      get: async function() {
        return [
          { data: () => ({ id: '123', codigo: 'VP-12345678', nome: 'Cliente Teste', status: 'Nova' }) }
        ];
      }
    };
  }
};

function ultimoCotacao() {
  return gravados.find(g => g.col === 'viajante_contas' && g.sub === 'cotacoes');
}

test('Viajante Pro — falha de envio (Brevo 500): cotação salva e emailNotificado false', async () => {
  gravados.length = 0;
  globalThis.fetch = async () => new Response('', { status: 500 });

  const { handler } = require('../../netlify/functions/viajante-pro');

  const event = {
    httpMethod: 'POST',
    body: JSON.stringify({
      acao: 'solicitar_cotacao',
      nome: 'Cliente Falha',
      email: 'cliente@teste.com',
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
  assert.equal(body.notificado, false);

  const cotacao = ultimoCotacao();
  assert.ok(cotacao, 'cotação deve ter sido gravada no Firestore mesmo com falha de e-mail');
  assert.equal(cotacao.data.emailNotificado, false);
  assert.ok(cotacao.data.emailErro, 'deve registrar o motivo do erro de envio');
});

test('Viajante Pro — sucesso de envio (Brevo 202): emailNotificado true', async () => {
  gravados.length = 0;
  globalThis.fetch = async () => new Response('', { status: 202 });

  const { handler } = require('../../netlify/functions/viajante-pro');

  const event = {
    httpMethod: 'POST',
    body: JSON.stringify({
      acao: 'solicitar_cotacao',
      nome: 'Cliente Sucesso',
      email: 'cliente@teste.com',
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
  assert.equal(body.notificado, true);

  const cotacao = ultimoCotacao();
  assert.ok(cotacao, 'cotação deve ter sido gravada no Firestore');
  assert.equal(cotacao.data.emailNotificado, true);
});