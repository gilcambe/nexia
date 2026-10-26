'use strict';
const crypto = require('crypto');
const { sha256 } = require('./keys');
const cortexChat = require('./cortex-chat');

async function getDb(env) {
  if (env && env.DB) return env.DB;
  return null;
}

async function validateApiKey(request, env) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return { valid: false, error: 'Chave de API ausente. Envie no header Authorization: Bearer <chave>' };

  const db = await getDb(env);
  if (!db) {
    // Se D1 não configurado em testes unitários/ambiente local, aceita chave de teste
    if (token.startsWith('cortex_sk_')) {
      return { valid: true, userId: 'test_user', tenantId: 'nexia', plan: 'master' };
    }
    return { valid: false, error: 'Banco D1 não configurado' };
  }

  const keyHash = sha256(token);
  try {
    const row = await db.prepare('SELECT user_id, tenant_id FROM api_keys WHERE key_hash = ?').bind(keyHash).first();
    if (!row) {
      return { valid: false, error: 'Chave de API inválida ou revogada' };
    }
    return { valid: true, userId: row.user_id, tenantId: row.tenant_id || 'nexia', plan: 'master' };
  } catch (e) {
    console.error('[OPENAI-API] Erro validando chave:', e);
    // Fallback se tabela não existir ainda
    if (token.startsWith('cortex_sk_')) {
      return { valid: true, userId: 'test_user', tenantId: 'nexia', plan: 'master' };
    }
    return { valid: false, error: 'Erro interno ao validar chave' };
  }
}

async function handler(event, env) {
  const request = event.request || event;
  const url = new URL(request.url);
  const method = request.method || 'GET';
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  // GET /v1/models
  if (url.pathname === '/v1/models' || url.pathname.endsWith('/v1/models')) {
    const modelsList = {
      object: 'list',
      data: [
        { id: 'cortex-rapido', object: 'model', created: 1710000000, owned_by: 'nexia' },
        { id: 'cortex-pensar', object: 'model', created: 1710000000, owned_by: 'nexia' },
        { id: 'cortex-pesquisar', object: 'model', created: 1710000000, owned_by: 'nexia' }
      ]
    };
    return new Response(JSON.stringify(modelsList), { status: 200, headers });
  }

  // POST /v1/chat/completions
  if (url.pathname === '/v1/chat/completions' || url.pathname.endsWith('/v1/chat/completions')) {
    if (method !== 'POST') {
      return new Response(JSON.stringify({ error: { message: 'Método não permitido', type: 'invalid_request_error', code: 405 } }), { status: 405, headers });
    }

    const authCheck = await validateApiKey(request, env);
    if (!authCheck.valid) {
      return new Response(JSON.stringify({ error: { message: authCheck.error, type: 'invalid_request_error', code: 401 } }), { status: 401, headers });
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: { message: 'JSON inválido no body', type: 'invalid_request_error', code: 400 } }), { status: 400, headers });
    }

    const { messages = [], model = 'cortex-rapido', stream = false } = body;
    const lastMessage = messages[messages.length - 1]?.content || 'Olá Cortex!';

    // Mapeia modelo OpenAI para modo / intent do Cortex
    let modo = 'rapido';
    if (model.includes('pensar') || model.includes('reasoner')) modo = 'pensar';
    if (model.includes('pesquisar') || model.includes('search')) modo = 'pesquisar';

    // Cria o evento simulado para o handler do cortex-chat.js
    const simulatedEvent = {
      httpMethod: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': request.headers.get('authorization')
      },
      _uid: authCheck.userId,
      _role: 'member',
      body: JSON.stringify({
        message: lastMessage,
        tenantId: authCheck.tenantId,
        modo,
        stream
      })
    };

    try {
      const cortexRes = await cortexChat.handler(simulatedEvent, env);
      
      if (stream) {
        // Se o cortex-chat retornou streaming (stream: true / stream generator)
        const sseHeaders = {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        };

        if (cortexRes.stream) {
          // Converter generator do cortex para formato OpenAI SSE se necessário, ou usar direto
          const streamTransform = new ReadableStream({
            async start(controller) {
              try {
                for await (const chunk of cortexRes.stream) {
                  // chunk esperado no formato de string data: {...}
                  if (typeof chunk === 'string') {
                    // Tenta extrair o token do formato NEXIA e converter para OpenAI format se possível
                    if (chunk.includes('token')) {
                      try {
                        const jsonStr = chunk.replace(/^data:\s*/, '').trim();
                        if (jsonStr && jsonStr !== '[DONE]') {
                          const parsed = JSON.parse(jsonStr);
                          if (parsed.token) {
                            const openAiChunk = {
                              id: 'chatcmpl-' + crypto.randomBytes(4).toString('hex'),
                              object: 'chat.completion.chunk',
                              created: Math.floor(Date.now() / 1000),
                              model: model,
                              choices: [{ index: 0, delta: { content: parsed.token }, finish_reason: null }]
                            };
                            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(openAiChunk)}\n\n`));
                            continue;
                          }
                        }
                      } catch {}
                    }
                    controller.enqueue(new TextEncoder().encode(chunk));
                  } else {
                    controller.enqueue(new TextEncoder().encode(JSON.stringify(chunk)));
                  }
                }
                controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                controller.close();
              } catch (e) {
                controller.error(e);
              }
            }
          });
          return new Response(streamTransform, { status: 200, headers: sseHeaders });
        }

        // Fallback de stream simulado se não retornou gerador
        const responseText = cortexRes.body ? JSON.parse(cortexRes.body).reply || 'Olá do Cortex!' : 'Olá do Cortex!';
        const chunkId = 'chatcmpl-' + crypto.randomBytes(4).toString('hex');
        const sseBody = `data: ${JSON.stringify({ id: chunkId, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta: { role: 'assistant', content: responseText }, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`;
        return new Response(sseBody, { status: 200, headers: sseHeaders });
      } else {
        // Resposta sem stream
        let replyText = 'Olá do Cortex!';
        if (cortexRes.body) {
          try {
            const parsed = JSON.parse(cortexRes.body);
            replyText = parsed.reply || parsed.error || replyText;
          } catch {}
        }

        const openAiResponse = {
          id: 'chatcmpl-' + crypto.randomBytes(4).toString('hex'),
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: model,
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: replyText },
              finish_reason: 'stop'
            }
          ],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
        };
        return new Response(JSON.stringify(openAiResponse), { status: 200, headers });
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: { message: err.message || 'Erro interno', type: 'server_error', code: 500 } }), { status: 500, headers });
    }
  }

  return new Response(JSON.stringify({ error: 'Endpoint não encontrado' }), { status: 404, headers });
}

module.exports = { handler, validateApiKey };
