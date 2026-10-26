'use strict';
const crypto = require('crypto');
const { sha256 } = require('./keys');
const cortexChat = require('./cortex-chat');

async function getDb(env) {
  if (env && env.DB) return env.DB;
  return null;
}

async function verifyApiKey(request, env) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return { valid: false, error: 'Chave de API ausente. Envie Bearer token no cabeçalho Authorization.' };

  const db = await getDb(env);
  const keyHash = sha256(token);

  if (!db) {
    // Modo de teste sem D1
    if (token === 'cortex_sk_exemplo123...' || token.startsWith('cortex_sk_')) {
      return { valid: true, userId: 'default_user', tenantId: 'nexia', plan: 'master' };
    }
    return { valid: false, error: 'Chave de API inválida.' };
  }

  try {
    const row = await db.prepare('SELECT user_id, tenant_id, plan FROM api_keys WHERE key_hash = ?').bind(keyHash).first();
    if (!row) {
      return { valid: false, error: 'Chave de API inválida ou revogada.' };
    }
    return { valid: true, userId: row.user_id || 'default_user', tenantId: row.tenant_id || 'nexia', plan: row.plan || 'master' };
  } catch (e) {
    console.error('[OPENAI API] Erro ao verificar chave no D1:', e);
    // Fallback permissivo para testes se a tabela ainda não existir
    if (token.startsWith('cortex_sk_')) {
      return { valid: true, userId: 'default_user', tenantId: 'nexia', plan: 'master' };
    }
    return { valid: false, error: 'Erro interno ao validar chave.' };
  }
}

async function handler(event, env) {
  const url = new URL(event.url || 'https://nexia.local/v1/chat/completions');
  const method = event.httpMethod || event.method || 'POST';
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // GET /v1/models
  if (url.pathname.endsWith('/models') || event.path === '/v1/models') {
    const models = {
      object: 'list',
      data: [
        { id: 'cortex-rapido', object: 'model', created: 1710000000, owned_by: 'nexia' },
        { id: 'cortex-pensar', object: 'model', created: 1710000000, owned_by: 'nexia' },
        { id: 'cortex-pesquisar', object: 'model', created: 1710000000, owned_by: 'nexia' }
      ]
    };
    return { statusCode: 200, headers, body: JSON.stringify(models) };
  }

  // POST /v1/chat/completions
  if (url.pathname.endsWith('/chat/completions') || event.path === '/v1/chat/completions') {
    const authResult = await verifyApiKey(event, env);
    if (!authResult.valid) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: { message: authResult.error, type: 'invalid_request_error', code: 'invalid_api_key' } })
      };
    }

    let reqBody = {};
    try {
      reqBody = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
    } catch {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: { message: 'JSON inválido no corpo da requisição', type: 'invalid_request_error', code: 'json_parse_error' } })
      };
    }

    const { model = 'cortex-rapido', messages = [], stream = false, max_tokens } = reqBody;
    const lastMessage = messages[messages.length - 1]?.content || 'Olá';

    // Mapeia o modelo solicitado para o intent do cortex
    let intent = 'fast';
    if (model.includes('pensar') || model.includes('reasoning')) intent = 'reasoning';
    if (model.includes('pesquisar') || model.includes('search')) intent = 'search';

    // Simula o evento para o cortex-chat.js existente
    const cortexEvent = {
      httpMethod: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': event.headers?.authorization || event.headers?.Authorization || 'Bearer test'
      },
      body: JSON.stringify({
        message: lastMessage,
        model: intent,
        tenantId: authResult.tenantId,
        stream: !!stream,
        maxTokens: max_tokens || 4096
      }),
      _uid: authResult.userId,
      _role: 'master'
    };

    try {
      const res = await cortexChat.handler(cortexEvent);
      
      if (stream) {
        // Se o cortex-chat retornou um stream real ou um body em SSE
        if (res.stream) {
          return { statusCode: 200, headers: { ...headers, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' }, stream: res.stream };
        }
        
        // Formata a resposta padrão no formato OpenAI SSE
        const completionId = 'chatcmpl-' + Math.random().toString(36).substring(2, 10);
        const created = Math.floor(Date.now() / 1000);
        let replyText = 'Olá! Cortex pronto para uso.';
        
        try {
          const parsed = JSON.parse(res.body || '{}');
          replyText = parsed.reply || parsed.token || 'Resposta indisponível';
        } catch {
          replyText = res.body || 'Resposta indisponível';
        }

        const sseStream = async function* () {
          yield `data: ${JSON.stringify({ id: completionId, object: 'chat.completion.chunk', created, model, choices: [{ index: 0, delta: { role: 'assistant', content: replyText }, finish_reason: null }] })}\n\n`;
          yield `data: ${JSON.stringify({ id: completionId, object: 'chat.completion.chunk', created, model, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`;
          yield `data: [DONE]\n\n`;
        };

        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
          stream: sseStream()
        };
      } else {
        // Sem stream
        let replyText = 'Cortex pronto.';
        try {
          const parsed = JSON.parse(res.body || '{}');
          replyText = parsed.reply || parsed.token || 'Resposta indisponível';
        } catch {
          replyText = res.body || 'Resposta indisponível';
        }

        const completionResponse = {
          id: 'chatcmpl-' + Math.random().toString(36).substring(2, 10),
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: replyText },
              finish_reason: 'stop'
            }
          ],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
        };

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(completionResponse)
        };
      }
    } catch (e) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: { message: e.message || 'Erro interno no Cortex', type: 'server_error', code: 'internal_error' } })
      };
    }
  }

  return { statusCode: 404, headers, body: JSON.stringify({ error: 'Não encontrado' }) };
}

module.exports = { handler, verifyApiKey };
