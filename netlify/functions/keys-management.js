'use strict';

const crypto = require('crypto');
const { admin, db } = require('./firebase-init');

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function handler(event, context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized: Missing token' }) };
  }

  // Verificar se o token é válido ou master admin
  let tenantId = 'default_tenant';
  let userId = 'user_demo';

  if (token.startsWith('cortex_sk_')) {
    const keyHash = sha256(token);
    // Tenta buscar no Firestore ou D1/Memory
    try {
      const keysRef = db ? db.collection('cortex_api_keys') : null;
      if (keysRef) {
        const snapshot = await keysRef.where('keyHash', '==', keyHash).get();
        if (snapshot.empty) {
          return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized: Invalid API key' }) };
        }
        const keyDoc = snapshot.docs[0].data();
        tenantId = keyDoc.tenantId || tenantId;
        userId = keyDoc.userId || userId;
      }
    } catch (e) {
      console.warn('[keys-verify] Erro ao checar Firestore:', e.message);
    }
  }

  const method = event.httpMethod;
  const path = event.path || '';

  if (method === 'GET') {
    // Listar chaves do usuário/tenant
    try {
      const keysRef = db ? db.collection('cortex_api_keys') : null;
      const keys = [];
      if (keysRef) {
        const snap = await keysRef.where('tenantId', '==', tenantId).get();
        snap.forEach(doc => {
          const d = doc.data();
          keys.push({ id: doc.id, name: d.name, createdAt: d.createdAt, prefix: d.prefix });
        });
      } else {
        keys.push({ id: 'demo_key_1', name: 'Chave Principal de Exemplo', createdAt: Date.now(), prefix: 'cortex_sk_ex' });
      }
      return { statusCode: 200, headers, body: JSON.stringify({ keys }) };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  if (method === 'POST') {
    // Criar nova chave
    try {
      let bodyData = {};
      try { bodyData = JSON.parse(event.body || '{}'); } catch {}
      const name = bodyData.name || 'Minha Chave Cortex';
      
      const rawKey = 'cortex_sk_' + crypto.randomBytes(24).toString('hex');
      const keyHash = sha256(rawKey);
      const prefix = rawKey.slice(0, 12) + '...';

      const keyRecord = {
        name,
        keyHash,
        prefix,
        tenantId,
        userId,
        createdAt: Date.now()
      };

      if (db) {
        const docRef = await db.collection('cortex_api_keys').add(keyRecord);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            id: docRef.id,
            name,
            key: rawKey, // MOSTRADA APENAS UMA VEZ AQUI
            message: 'Guarde esta chave agora. Ela não será mostrada novamente.'
          })
        };
      } else {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            id: 'mock_id_' + Date.now(),
            name,
            key: rawKey,
            message: 'Chave criada com sucesso (Modo Mock).'
          })
        };
      }
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  if (method === 'DELETE') {
    // Apagar chave por ID ou hash
    try {
      let bodyData = {};
      try { bodyData = JSON.parse(event.body || '{}'); } catch {}
      const keyId = bodyData.id || event.queryStringParameters?.id;

      if (!keyId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'ID da chave não informado' }) };
      }

      if (db) {
        await db.collection('cortex_api_keys').doc(keyId).delete();
      }

      return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Chave revogada com sucesso' }) };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
}

module.exports = { handler, sha256 };
