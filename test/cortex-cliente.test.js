import { test } from 'node:test';
import assert from 'node:assert';
import { Miniflare } from 'miniflare';
import jwt from 'jsonwebtoken';

// Chave de teste simulada
const TEST_SECRET = 'test-secret-key-for-jwt-signing';

// Configuração do Miniflare para testes
const mf = new Miniflare({
  kvNamespaces: ['TEST'],
  modules: true,
  vars: { JWT_SECRET: TEST_SECRET },
  script: `
    import { authenticate } from '../lib/cortex-cliente.js';
    
    export default {
      async fetch(request, env, ctx) {
        const url = new URL(request.url);
        
        if (url.pathname === '/api/cortex-cliente/conversas') {
          // Criar objeto de requisição simulado para o middleware
          const mockReq = {
            headers: {
              authorization: request.headers.get('Authorization')
            }
          };
          
          const mockRes = {
            status: (code) => ({
              json: (data) => new Response(JSON.stringify(data), {
                status: code,
                headers: { 'Content-Type': 'application/json' }
              })
            })
          };
          
          // Usar o middleware de autenticação
          return new Promise((resolve) => {
            authenticate(mockReq, mockRes, () => {
              // Se autenticado, continuar com a lógica
              const decoded = mockReq.user;
              
              // Simular dados do usuário
              const userConversations = {
                uidA: [
                  { id: 'conv1', title: 'Conversa 1', messages: 5 },
                  { id: 'conv2', title: 'Conversa 2', messages: 3 }
                ],
                uidB: [
                  { id: 'conv3', title: 'Conversa 3', messages: 8 }
                ]
              };
              
              const conversations = userConversations[decoded.uid] || [];
              
              resolve(new Response(JSON.stringify({
                success: true,
                uid: decoded.uid,
                conversations
              }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              }));
            });
          });
        }
        
        return new Response('Not Found', { status: 404 });
      }
    };
  `
});

// Gerar tokens de teste
function generateTestToken(uid) {
  return jwt.sign(
    { uid, type: 'access', exp: Math.floor(Date.now() / 1000) + (60 * 60) },
    TEST_SECRET
  );
}

const uidAToken = generateTestToken('uidA');
const uidBToken = generateTestToken('uidB');

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

