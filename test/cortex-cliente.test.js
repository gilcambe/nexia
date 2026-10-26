import { test } from 'node:test';
import assert from 'node:assert';
import { Miniflare } from 'miniflare';
import jwt from 'jsonwebtoken';

// Configuração do Miniflare para testes
const mf = new Miniflare({
  kvNamespaces: ['TEST'],
  modules: true,
  script: `
    export default {
      async fetch(request, env, ctx) {
        const url = new URL(request.url);
        
        if (url.pathname === '/api/cortex-cliente/conversas') {
          const authHeader = request.headers.get('Authorization');
          
          if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          if (!authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Invalid token format' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          const token = authHeader.substring(7);
          
          try {
            const decoded = jwt.verify(token, env.JWT_SECRET);
            
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
            
            return new Response(JSON.stringify({
              success: true,
              uid: decoded.uid,
              conversations
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          } catch (error) {
            return new Response(JSON.stringify({ error: 'Forbidden' }), {
              status: 403,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }
        
        return new Response('Not Found', { status: 404 });
      }
    };
  `
});

// Chave de teste simulada
const TEST_SECRET = 'test-secret-key-for-jwt-signing';

// Gerar tokens de teste
function generateTestToken(uid) {
  return jwt.sign(
    { uid, type: 'access', exp: Math.floor(Date.now() / 1000) + (60 * 60) },
    TEST_SECRET
  );
}

const uidAToken = generateTestToken('uidA');
const uidBToken = generateTestToken('uidB');

test('cortex-cliente API - Testes de autenticação', async () => {
  // Teste 1: Acesso com token uidA deve retornar dados do uidA
  const response1 = await mf.dispatchFetch('http://localhost:8787/api/cortex-cliente/conversas', {
    headers: {
      'Authorization': `Bearer ${uidAToken}`
    }
  });
  
  const result1 = await response1.json();
  assert.strictEqual(response1.status, 200);
  assert.strictEqual(result1.success, true);
  assert.strictEqual(result1.uid, 'uidA');
  assert.strictEqual(result1.conversations.length, 2);
  assert.strictEqual(result1.conversations[0].title, 'Conversa 1');
  
  // Teste 2: Acesso com token uidB deve retornar 403
  const response2 = await mf.dispatchFetch('http://localhost:8787/api/cortex-cliente/conversas', {
    headers: {
      'Authorization': `Bearer ${uidBToken}`
    }
  });
  
  const result2 = await response2.json();
  assert.strictEqual(response2.status, 403);
  assert.strictEqual(result2.error, 'Forbidden');
  
  // Teste 3: Sem token Authorization deve retornar 401
  const response3 = await mf.dispatchFetch('http://localhost:8787/api/cortex-cliente/conversas');
  
  const result3 = await response3.json();
  assert.strictEqual(response3.status, 401);
  assert.strictEqual(result3.error, 'Unauthorized');
});

console.log('Testes do cortex-cliente configurados com sucesso!');