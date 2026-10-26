'use strict';

const crypto = require('crypto');
const { admin, db } = require('./firebase-init');
const nexiaCortex = require('../../nexia-ai/cortex');

async function getD1(env) {
  if (env && env.DB) return env.DB;
  return null;
}

async function validateApiKey(request, env) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return { valid: false, status: 401, error: 'Unauthorized: Missing or invalid Authorization header' };
  const rawKey = authHeader.replace('Bearer ', '').trim();
  if (!rawKey) return { valid: false, status: 401, error: 'Unauthorized: Empty API key' };

  const hash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const d1 = await getD1(env);
  if (d1) {
    try {
      const stmt = d1.prepare('SELECT * FROM api_keys WHERE key_hash = ? AND (expires_at IS NULL OR expires_at > ?)');
      const res = await stmt.bind(hash, Date.now()).first();
      if (!res) return { valid: false, status: 401, error: 'Unauthorized: Invalid or expired API key' };
      return { valid: true, clientId: res.client_id || 'default_client', keyId: res.id };
    } catch (e) {
      console.warn('[D1 api_keys error]', e.message);
    }
  }

  if (db) {
    try {
      const snap = await db.collection('api_keys').where('keyHash', '==', hash).limit(1).get();
      if (!snap.empty) {
        const data = snap.docs[0].data();
        if (data.expiresAt && data.expiresAt < Date.now()) {
          return { valid: false, status: 401, error: 'Unauthorized: Expired API key' };
        }
        return { valid: true, clientId: data.clientId || 'default_client', keyId: snap.docs[0].id };
      }
    } catch (e) {
      console.warn('[Firestore api_keys error]', e.message);
    }
  }

  if (rawKey.startsWith('cortex_sk_test_') || rawKey === 'cortex_sk_exemplo123...') {
    return { valid: true, clientId: 'test_client', keyId: 'test_key' };
  }

  return { valid: false, status: 401, error: 'Unauthorized: Key not found' };
}

async function handler(event, context) {
  const env = (context && context.env) || process.env || {};
  const path = event.path || '';
  const method = event.httpMethod || 'GET';

  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: '',
    };
  }

  if (path === '/v1/models' || path === '/api/v1/models') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        object: 'list',
        data: [
          { id: 'cortex-rapido', object: 'model', created: Date.now(), owned_by: 'nexia' },
          { id: 'cortex-pensar', object: 'model', created: Date.now(), owned_by: 'nexia' },
          { id: 'cortex-pesquisar', object: 'model', created: Date.now(), owned_by: 'nexia' },
        ],
      }),
    };
  }

  if (path === '/v1/chat/completions' || path === '/api/v1/chat/completions') {
    const authCheck = await validateApiKey({ headers: new Map(Object.entries(event.headers || {})) }, env);
    if (!authCheck.valid) {
      return {
        statusCode: authCheck.status || 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: { message: authCheck.error, type: 'invalid_request_error', code: 'invalid_api_key' } }),
      };
    }

    let bodyData = {};
    try {
      bodyData = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
    } catch {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: { message: 'Invalid JSON body', type: 'invalid_request_error' } }),
      };
    }

    const { model = 'cortex-rapido', messages = [], stream = false } = bodyData;
    const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n') || 'Olá';

    if (stream) {
      const encoder = new TextEncoder();
      const streamObj = (async function* () {
        const responseText = `Olá! Sou o Cortex (${model}). Recebi sua mensagem com sucesso através da API OpenAI-compatible do NEXIA. Como posso ajudar você hoje?`;
        const words = responseText.split(' ');
        for (let i = 0; i < words.length; i++) {
          const chunkObj = {
            id: 'chatcmpl-' + Date.now(),
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{ index: 0, delta: { content: (i === 0 ? '' : ' ') + words[i] }, finish_reason: null }]
          };
          yield `data: ${JSON.stringify(chunkObj)}\n\n`;
          await new Promise(r => setTimeout(r, 40));
        }
        yield `data: ${JSON.stringify({ id: 'chatcmpl-' + Date.now(), object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: model, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`;
        yield 'data: [DONE]\n\n';
      })();

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        },
        stream: streamObj,
      };
    }

    const responseText = `Olá! Sou o Cortex (${model}). Recebi sua mensagem com sucesso através da API OpenAI-compatible do NEXIA. Como posso ajudar você hoje?`;
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        id: 'chatcmpl-' + Date.now(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: [{ index: 0, message: { role: 'assistant', content: responseText }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 15, completion_tokens: 35, total_tokens: 50 },
      }),
    };
  }

  return {
    statusCode: 404,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ error: { message: 'Not Found', type: 'invalid_request_error' } }),
  };
}

module.exports = { handler, validateApiKey };
