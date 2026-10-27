import { test } from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import { authenticate } from '../lib/cortex-cliente.js';

// Chave de teste simulada (o middleware usa esta chave via env JWT_SECRET)
process.env.NODE_ENV = 'test';
const JWT_SECRET = 'test-secret-key-for-jwt-signing';

// Gerar tokens JWT de teste assinados com a mesma chave
function generateTestToken(uid) {
  return jwt.sign(
    { uid, type: 'access', exp: Math.floor(Date.now() / 1000) + (60 * 60) },
    JWT_SECRET
  );
}

const uidAToken = generateTestToken('uidA');
const uidBToken = generateTestToken('uidB');

// Dados simulados de conversas por uid
const userConversations = {
  uidA: [
    { id: 'conv1', title: 'Conversa 1', messages: 5 },
    { id: 'conv2', title: 'Conversa 2', messages: 3 }
  ],
  uidB: [
    { id: 'conv3', title: 'Conversa 3', messages: 8 }
  ]
};

// Resposta simulada (Express-like)
function makeRes() {
  let statusCode = 200;
  let body = null;
  return {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      body = data;
      return this;
    },
    get status() {
      return statusCode;
    },
    get jsonBody() {
      return body;
    }
  };
}

test('cortex-cliente: 200 com token uidA', () => {
  const req = { headers: { authorization: `Bearer ${uidAToken}` } };
  const res = makeRes();
  authenticate(req, res, () => {
    const conversations = userConversations[req.user.uid] || [];
    res.status(200).json({
      success: true,
      uid: req.user.uid,
      conversations
    });
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.jsonBody.success, true);
  assert.strictEqual(res.jsonBody.uid, 'uidA');
  assert.strictEqual(res.jsonBody.conversations.length, 2);
  assert.strictEqual(res.jsonBody.conversations[0].title, 'Conversa 1');
});

test('cortex-cliente: 403 com token uidB', () => {
  const req = { headers: { authorization: `Bearer ${uidBToken}` } };
  const res = makeRes();
  const result = authenticate(req, res, () => {});

  assert.strictEqual(result.status, 403);
  assert.strictEqual(result.jsonBody.error, 'Forbidden');
});

test('cortex-cliente: 401 sem token Authorization', () => {
  const req = { headers: {} };
  const res = makeRes();
  const result = authenticate(req, res, () => {});

  assert.strictEqual(result.status, 401);
  assert.strictEqual(result.jsonBody.error, 'Unauthorized');
});
