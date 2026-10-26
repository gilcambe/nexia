'use strict';
const crypto = require('crypto');

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function getDb(env) {
  if (env && env.DB) return env.DB;
  return null;
}

async function ensureTable(db) {
  if (!db) return;
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        key_hash TEXT NOT NULL,
        name TEXT,
        created_at INTEGER NOT NULL
      )
    `).run();
  } catch (e) {
    console.error('[API KEYS] Error creating table:', e);
  }
}

async function handler(event, env) {
  const method = event.httpMethod || 'GET';
  const headers = { 'Content-Type': 'application/json' };
  const db = await getDb(env);
  await ensureTable(db);

  const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const userId = event.queryStringParameters?.userId || event.headers?.['x-user-id'] || 'default_user';

  if (!db) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, keys: [], warning: 'D1 not configured, using mock' }) };
  }

  if (method === 'GET') {
    try {
      const { results } = await db.prepare('SELECT id, name, created_at FROM api_keys WHERE user_id = ?').bind(userId).all();
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, keys: results || [] }) };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  if (method === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const name = body.name || 'Chave Padrão';
      const rawKey = 'cortex_sk_' + crypto.randomBytes(24).toString('hex');
      const keyHash = sha256(rawKey);
      const id = 'key_' + crypto.randomBytes(8).toString('hex');
      const createdAt = Date.now();

      await db.prepare('INSERT INTO api_keys (id, user_id, key_hash, name, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(id, userId, keyHash, name, createdAt)
        .run();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, id, name, apiKey: rawKey, message: 'Guarde esta chave agora. Ela não será mostrada novamente.' })
      };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  if (method === 'DELETE') {
    try {
      const keyId = event.queryStringParameters?.id || JSON.parse(event.body || '{}').id;
      if (!keyId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'ID obrigatório' }) };

      await db.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?').bind(keyId, userId).run();
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método não permitido' }) };
}

module.exports = { handler, sha256, ensureTable };
