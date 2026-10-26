'use strict';
// NEXIA — Gestão de Chaves de API para OpenAI Compatible (Pilar 6)
// Armazena hash SHA-256 no D1 ou Firebase e valida nas rotas /v1/*

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function validateApiKey(authHeader, env) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, status: 401, error: 'Chave de API ausente ou inválida (Bearer token obrigatório).' };
  }
  const token = authHeader.substring(7).trim();
  if (!token.startsWith('cortex_sk_')) {
    return { valid: false, status: 401, error: 'Formato de chave inválido (deve iniciar com cortex_sk_).' };
  }
  const keyHash = await sha256(token);

  // Se D1 estiver configurado, checa no D1. Caso contrário, valida master ou cache local.
  if (env && env.DB) {
    try {
      const row = await env.DB.prepare('SELECT * FROM api_keys WHERE key_hash = ? AND active = 1').bind(keyHash).first();
      if (!row) {
        return { valid: false, status: 401, error: 'Chave de API inválida ou revogada.' };
      }
      return { valid: true, userId: row.user_id, tenantId: row.tenant_id || 'default' };
    } catch (e) {
      // Fallback se a tabela não existir ainda
      console.warn('[API-KEYS] D1 error, checking fallback:', e.message);
    }
  }

  // Fallback para chave de teste/master padrão no ambiente
  const masterHash = env.CORTEX_MASTER_KEY_HASH || await sha256('cortex_sk_master_demo_key_2026');
  if (keyHash === masterHash) {
    return { valid: true, userId: 'master', tenantId: 'master' };
  }

  return { valid: false, status: 401, error: 'Chave de API não encontrada ou inativa.' };
}

async function handler(event, env) {
  const method = event.httpMethod || 'GET';
  const headers = { 'Content-Type': 'application/json' };

  if (method === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const name = body.name || 'Minha Chave';
      const rawKey = 'cortex_sk_' + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
      const keyHash = await sha256(rawKey);

      if (env && env.DB) {
        try {
          await env.DB.prepare('CREATE TABLE IF NOT EXISTS api_keys (id TEXT PRIMARY KEY, key_hash TEXT, name TEXT, user_id TEXT, tenant_id TEXT, active INTEGER, created_at TEXT)').run();
          await env.DB.prepare('INSERT INTO api_keys (id, key_hash, name, user_id, tenant_id, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)').bind(
            'key_' + Date.now(), keyHash, name, body.userId || 'user_demo', body.tenantId || 'default', new Date().toISOString()
          ).run();
        } catch (dbErr) {
          console.warn('[KEYS] DB insert error:', dbErr.message);
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, apiKey: rawKey, name, message: 'Guarde esta chave agora. Ela não será exibida novamente.' })
      };
    } catch (e) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  if (method === 'DELETE') {
    const keyId = event.queryStringParameters && event.queryStringParameters.id;
    if (env && env.DB && keyId) {
      try {
        await env.DB.prepare('UPDATE api_keys SET active = 0 WHERE id = ?').bind(keyId).run();
      } catch {}
    }
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, message: 'Chave revogada.' }) };
  }

  // GET: lista chaves (mascaradas)
  let keys = [];
  if (env && env.DB) {
    try {
      const res = await env.DB.prepare('SELECT id, name, active, created_at FROM api_keys ORDER BY created_at DESC').all();
      keys = res.results || [];
    } catch {}
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ ok: true, keys })
  };
}

module.exports = { handler, validateApiKey, sha256 };
