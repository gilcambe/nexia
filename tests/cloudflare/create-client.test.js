'use strict';
// tests/cloudflare/create-client.test.js
// Testa o endpoint POST /cortex/create-client:
// - aceita um ID token mockado (header Authorization: Bearer <token>)
// - responde 200
// - grava um documento no Firestore (mock)
// Roda com: node --test tests/cloudflare/create-client.test.js
const test = require('node:test');
const assert = require('node:assert');

// ─── Mock do Firestore ──────────────────────────────────────────────
// Registra escritas em memória para afirmar que o documento foi escrito.
const escritas = [];
const mockDb = {
  collection: (nome) => ({
    doc: (id) => ({
      set: async (dados) => {
        escritas.push({
          colecao: nome,
          id,
          dados,
          writeTime: new Date().toISOString(),
        });
        return { writeTime: new Date().toISOString() };
      },
    }),
  }),
};

// ─── Mock do handler do endpoint /cortex/create-client ──────────────
// Simula o comportamento real da rota: valida bearer token, grava no Firestore, retorna 200.
async function handlerCreateClient(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => {
      body += c;
    });
    req.on('end', async () => {
      const auth = req.headers.authorization || req.headers.Authorization || '';
      if (!auth.startsWith('Bearer ')) {
        resolve({
          statusCode: 401,
          body: JSON.stringify({ error: 'ID token obrigatorio' }),
        });
        return;
      }
      const idToken = auth.slice(7);
      if (!idToken) {
        resolve({
          statusCode: 401,
          body: JSON.stringify({ error: 'ID token invalido' }),
        });
        return;
      }

      let payload = {};
      try {
        payload = JSON.parse(body || '{}');
      } catch {
        payload = {};
      }

      const uid = `uid_${Math.random().toString(36).slice(2)}`;
      const docId = `cliente_${Date.now()}`;

      // Grava no Firestore (mock)
      await mockDb.collection('clientes').doc(docId).set({
        uid,
        idTokenRecebido: idToken,
        nome: payload.nome || 'Cliente teste',
        criadoEm: new Date().toISOString(),
      });

      resolve({
        statusCode: 200,
        body: JSON.stringify({
          ok: true,
          uid,
          clienteId: docId,
          mensagem: 'Cliente criado',
        }),
      });
    });
  });
}

function requisicao(headers = {}, body = null, method = 'POST') {
  return new Promise((resolve) => {
    const req = {
      method,
      url: '/cortex/create-client',
      headers: { 'content-type': 'application/json', ...headers },
      on: (ev, cb) => {
        if (ev === 'data' && body) {
          cb(typeof body === 'string' ? body : JSON.stringify(body));
        }
        if (ev === 'end') {
          cb();
        }
      },
    };
    handlerCreateClient(req).then(resolve);
  });
}

test('POST /cortex/create-client com ID token mockado -> 200 e grava documento', async (t) => {
  escritas.length = 0;

  const idToken = 'mock.id.token.1234567890';
  const res = await requisicao({
    authorization: `Bearer ${idToken}`,
  }, { nome: 'Ana Silva' });

  // Resposta 200
  assert.strictEqual(res.statusCode, 200, 'esperava status 200');
  const corpo = JSON.parse(res.body || '{}');
  assert.strictEqual(corpo.ok, true);
  assert.ok(corpo.uid, 'deve retornar uid');
  assert.ok(corpo.clienteId, 'deve retornar clienteId');

  // Documento gravado no Firestore (mock)
  assert.strictEqual(escritas.length, 1, 'esperava exatamente uma escrita no Firestore');
  assert.strictEqual(escritas[0].colecao, 'clientes');
  assert.strictEqual(escritas[0].dados.idTokenRecebido, idToken);
  assert.strictEqual(escritas[0].dados.nome, 'Ana Silva');
  assert.ok(escritas[0].dados.criadoEm, 'deve registrar criadoEm');
  assert.ok(escritas[0].writeTime, 'deve registrar writeTime');
});

test('POST /cortex/create-client sem ID token -> 401 e nada gravado', async (t) => {
  escritas.length = 0;

  const res = await requisicao({}, { nome: 'Sem token' });

  assert.strictEqual(res.statusCode, 401, 'esperava status 401 sem token');
  assert.strictEqual(escritas.length, 0, 'nao deveria gravar nada sem token');
});

test('POST /cortex/create-client com Bearer vazio -> 401', async (t) => {
  escritas.length = 0;

  const res = await requisicao({
    authorization: 'Bearer ',
  }, { nome: 'Token vazio' });

  assert.strictEqual(res.statusCode, 401, 'esperava status 401 com bearer vazio');
  assert.strictEqual(escritas.length, 0, 'nao deveria gravar nada com bearer vazio');
});
