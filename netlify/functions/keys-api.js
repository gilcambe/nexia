'use strict';

const crypto = require('crypto');

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

// Simula banco em D1 ou memória persistente para chaves de API do Cortex
const memoryKeys = new Map();

function createKey(userId, name) {
  const rawKey = 'cortex_sk_' + crypto.randomBytes(24).toString('hex');
  const keyHash = sha256(rawKey);
  const id = 'key_' + crypto.randomBytes(6).toString('hex');
  const record = {
    id,
    userId: userId || 'user_default',
    name: name || 'Chave padrão',
    keyHash,
    createdAt: new Date().toISOString(),
    lastUsed: null
  };
  memoryKeys.set(keyHash, record);
  return { id, rawKey, name: record.name, createdAt: record.createdAt };
}

function validateKey(rawKey) {
  if (!rawKey || typeof rawKey !== 'string') return null;
  const hash = sha256(rawKey.trim());
  return memoryKeys.get(hash) || null;
}

function listKeys(userId) {
  const results = [];
  for (const record of memoryKeys.values()) {
    if (!userId || record.userId === userId) {
      results.push({
        id: record.id,
        name: record.name,
        createdAt: record.createdAt,
        lastUsed: record.lastUsed,
        prefix: 'cortex_sk_...'
      });
    }
  }
  return results;
}

function revokeKey(id, userId) {
  for (const [hash, record] of memoryKeys.entries()) {
    if (record.id === id && (!userId || record.userId === userId)) {
      memoryKeys.delete(hash);
      return true;
    }
  }
  return false;
}

// Handler serverless para gerenciar chaves em /api/keys
async function handler(event) {
  const method = event.httpMethod || 'GET';
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  if (method === 'GET') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ keys: listKeys('user_default') })
    };
  }

  if (method === 'POST') {
    try {
      const data = JSON.parse(event.body || '{}');
      const nova = createKey('user_default', data.name);
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ success: true, ...nova })
      };
    } catch (e) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Payload inválido' }) };
    }
  }

  if (method === 'DELETE') {
    const query = event.queryStringParameters || {};
    const id = query.id;
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'ID obrigatório' }) };
    const ok = revokeKey(id, 'user_default');
    return {
      statusCode: ok ? 200 : 404,
      headers,
      body: JSON.stringify({ success: ok })
    };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
}

module.exports = { createKey, validateKey, listKeys, revokeKey, handler, sha256 };
