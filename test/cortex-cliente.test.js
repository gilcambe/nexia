import { test } from 'node:test';
import assert from 'node:assert';
import { Miniflare } from 'miniflare';
import { authenticate } from '../lib/cortex-cliente.js';

// Chave de teste simulada (o middleware usa esta chave via env JWT_SECRET)
const JWT_SECRET = 'test-secret-key-for-jwt-signing';

// Gerar tokens JWT de teste assinados com a mesma chave
import jwt from 'jsonwebtoken';
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

// Worker real que importa e usa o middleware authenticate de lib/cortex-cliente.js
const mf = new Miniflare({
  modules: true,
  vars: { JWT_SECRET },
  script: `
    import { authenticate } from '../lib/cortex-cliente.js';
    
    const userConversations = {
      uidA: [
        { id: 'conv1', title: 'Conversa 1', messages: 5 },
        { id: 'conv2', title: 'Conversa 2', messages: 3 }
      ],
      uidB: [
        { id: 'conv3', title: 'Conversa 3', messages: 8 }
      ]
    };
    
    export default {
      async fetch(request, env, ctx) {
        const url = new URL(request.url);
        
        if (url.pathname === '/api/cortex-cliente/conversas') {
          // Usar o middleware real de autenticação
          return new Promise((resolve) => {
            authenticate(
              {
                headers: { authorization: request.headers.get('Authorization') }
              },
              {
                status: (code) => ({
                  json: (data) => new Response(JSON.stringify(data), {
                    status: code,
                    headers: { 'Content-Type': 'application/json' }
                  })
                })
              },
              () => {
                // Autenticado: retornar conversas do usuário
                // eslint-disable-next-line no-undef
                const decoded = req.user;
                const conversations = userConversations[decoded.uid] || [];
                resolve(new Response(JSON.stringify({
                  success: true,
                  uid: decoded.uid,
                  conversations
                }), {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' }
                }));
              }
            );
          });
        }
        
        return new Response('Not Found', { status: 404 });
      }
    };
  `
});

test('cortex-cliente: 200 com token uidA', async () => {
  const response = await mf.dispatchFetch('http://localhost:8787/api/cortex-cliente/conversas', {
    headers: {
      'Authorization': `Bearer ${uidAToken}`
    }
  });
  
  const result = await response.json();
  assert.strictEqual(response.status, 200);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.uid, 'uidA');
  assert.strictEqual(result.conversations.length, 2);
  assert.strictEqual(result.conversations[0].title, 'Conversa 1');
});

test('cortex-cliente: 403 com token uidB', async () => {
  const response = await mf.dispatchFetch('http://localhost:8787/api/cortex-cliente/conversas', {
    headers: {
      'Authorization': `Bearer ${uidBToken}`
    }
  });
  
  const result = await response.json();
  assert.strictEqual(response.status, 403);
  assert.strictEqual(result.error, 'Forbidden');
});

test('cortex-cliente: 401 sem token Authorization', async () => {
  const response = await mf.dispatchFetch('http://localhost:8787/api/cortex-cliente/conversas');
  
  const result = await response.json();
  assert.strictEqual(response.status, 401);
  assert.strictEqual(result.error, 'Unauthorized');
});
