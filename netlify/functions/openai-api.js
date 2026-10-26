'use strict';
const { sha256 } = require('./keys');
const modelRouter = require('../../nexia-ai/model-router');

const OPENAI_MODELS = [
  { id: 'cortex-rapido', object: 'model', created: 1710000000, owned_by: 'nexia', permission: [], root: 'cortex-rapido', parent: null },
  { id: 'cortex-pensar', object: 'model', created: 1710000000, owned_by: 'nexia', permission: [], root: 'cortex-pensar', parent: null },
  { id: 'cortex-pesquisar', object: 'model', created: 1710000000, owned_by: 'nexia', permission: [], root: 'cortex-pesquisar', parent: null }
];

async function verifyApiKey(event, env) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
  if (!authHeader.startsWith('Bearer ')) return { valid: false, error: 'Token ausente ou inválido' };
  const rawKey = authHeader.slice(7).trim();
  const keyHash = sha256(rawKey);

  const db = env && env.DB ? env.DB : null;
  if (!db) {
    if (rawKey.startsWith('cortex_sk_')) return { valid: true, userId: 'default_user', tenantId: 'nexia', plan: 'master' };
    return { valid: false, error: 'Chave inválida' };
  }

  try {
    const row = await db.prepare('SELECT user_id, tenant_id FROM api_keys WHERE key_hash = ?').bind(keyHash).first();
    if (!row) return { valid: false, error: 'Chave não encontrada ou revogada' };
    return { valid: true, userId: row.user_id || 'default_user', tenantId: row.tenant_id || 'nexia', plan: 'master' };
  } catch (e) {
    return { valid: false, error: 'Erro ao validar chave' };
  }
}

async function handler(event, env) {
  const method = event.httpMethod || 'GET';
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (method === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const urlPath = event.path || event.rawPath || '';
  
  if (method === 'GET' && (urlPath.includes('/v1/models') || event.queryStringParameters?.models)) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ object: 'list', data: OPENAI_MODELS })
    };
  }

  if (method === 'POST' && urlPath.includes('/v1/chat/completions')) {
    const auth = await verifyApiKey(event, env);
    if (!auth.valid) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: { message: auth.error, type: 'invalid_request_error', code: 'invalid_api_key' } }) };
    }

    let body = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, headers, body: JSON.stringify({ error: { message: 'JSON inválido', type: 'invalid_request_error' } }) };
    }

    const { messages = [], model = 'cortex-rapido', stream = false } = body;
    if (!messages.length) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: { message: 'messages é obrigatório', type: 'invalid_request_error' } }) };
    }

    const systemPrompt = "Você é o Cortex, IA avançada integrada ao NEXIA OS compatível com OpenAI.";
    const modelDesc = { provider: 'groq', model: 'openai/gpt-oss-120b' };
    if (model === 'cortex-rapido') modelDesc.model = 'openai/gpt-oss-20b';
    if (model === 'cortex-pesquisar') modelDesc.model = 'meta/llama-3.3-70b-instruct';

    if (stream) {
      const sseHeaders = {
        ...headers,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      };
      
      async function* sseGenerator() {
        let fullText = '';
        const id = 'chatcmpl-' + Math.random().toString(36).slice(2);
        const created = Math.floor(Date.now() / 1000);

        try {
          // Usa o model-router real
          for await (const chunk of modelRouter.getRouter().streamWithFallback([modelDesc], { system: systemPrompt, messages, maxTokens: 4000 })) {
            if (chunk.type === 'text') {
              fullText += chunk.text;
              const chunkObj = {
                id,
                object: 'chat.completion.chunk',
                created,
                model,
                choices: [{ index: 0, delta: { content: chunk.text }, finish_reason: null }]
              };
              yield `data: ${JSON.stringify(chunkObj)}\n\n`;
            }
          }
        } catch (e) {
          const errChunk = {
            id,
            object: 'chat.completion.chunk',
            created,
            model,
            choices: [{ index: 0, delta: { content: '\n\n[Erro no streaming]' }, finish_reason: 'stop' }]
          };
          yield `data: ${JSON.stringify(errChunk)}\n\n`;
        }

        const finishObj = {
          id,
          object: 'chat.completion.chunk',
          created,
          model,
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
        };
        yield `data: ${JSON.stringify(finishObj)}\n\n`;
        yield 'data: [DONE]\n\n';
      }

      return { statusCode: 200, headers: sseHeaders, stream: sseGenerator() };
    }

    try {
      const result = await modelRouter.getRouter().chat(modelDesc, { system: systemPrompt, messages, maxTokens: 4000 });
      const responseObj = {
        id: 'chatcmpl-' + Math.random().toString(36).slice(2),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{
          index: 0,
          message: { role: 'assistant', content: result.text },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
      };
      return { statusCode: 200, headers, body: JSON.stringify(responseObj) };
    } catch (e) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: { message: e.message || 'Erro interno', type: 'internal_error' } })
      };
    }
  }

  return { statusCode: 404, headers, body: JSON.stringify({ error: 'Endpoint não encontrado' }) };
}

module.exports = { handler, verifyApiKey };
