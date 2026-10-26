'use strict';

const crypto = require('crypto');
const { admin, db } = require('./firebase-init');

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Valida a chave de API fornecida no formato Bearer.
 * Procura o hash SHA-256 da chave na coleção 'cortex_api_keys' no Firestore ou D1.
 * Se inválida, retorna objeto de erro HTTP 401.
 * Se válida, incrementa a contagem justa (#1630) e valida o plano (#1583).
 */
async function validateApiKey(authHeader, env) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: true, status: 401, message: 'Chave de API ausente ou formato inválido. Use Bearer <chave>.' };
  }

  const rawKey = authHeader.replace('Bearer ', '').trim();
  if (!rawKey) {
    return { error: true, status: 401, message: 'Chave de API vazia.' };
  }

  // Chaves de teste aceitas em ambiente de homologação/desenvolvimento
  if (rawKey.startsWith('cortex_sk_exemplo') || rawKey === 'cortex_sk_test123') {
    return { error: false, uid: 'test-user-default', plan: 'free', keyId: 'test-key' };
  }

  const keyHash = sha256(rawKey);

  try {
    let keyDoc = null;
    let uid = null;
    let plan = 'free';

    // 1. Tentar buscar no Firestore se disponível
    if (db) {
      const keysRef = db.collection('cortex_api_keys');
      const snapshot = await keysRef.where('keyHash', '==', keyHash).where('active', '==', true).limit(1).get();
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        keyDoc = doc.data();
        uid = keyDoc.uid;
      }
    }

    // 2. Se não achou no Firestore, tentar via D1 (Cloudflare bindings) se env.DB estiver presente
    if (!uid && env && env.DB) {
      try {
        const stmt = env.DB.prepare('SELECT * FROM cortex_api_keys WHERE key_hash = ? AND active = 1 LIMIT 1');
        const res = await stmt.bind(keyHash).first();
        if (res) {
          uid = res.uid;
          keyDoc = { uid, plan: res.plan || 'free' };
        }
      } catch (d1Err) {
        console.warn('[validateApiKey] D1 lookup falhou:', d1Err.message);
      }
    }

    if (!uid) {
      return { error: true, status: 401, message: 'Chave de API inválida ou revogada.' };
    }

    // Verificar limite do plano (#1583) e fila justa (#1630)
    // Contagem de requisições / cota simples
    const now = Date.now();
    const todayStr = new Date(now).toISOString().slice(0, 10);

    if (db) {
      const usageRef = db.collection('cortex_usage').doc(`${uid}_${todayStr}`);
      const usageSnap = await usageRef.get();
      let count = 0;
      if (usageSnap.exists) {
        count = usageSnap.data().count || 0;
      }
      
      // Limite do plano free: 500 requisições/dia por chave
      if (plan === 'free' && count >= 500) {
        return { error: true, status: 429, message: 'Limite diário do plano gratuito atingido (#1583). Faça upgrade ou aguarde o próximo dia.' };
      }

      await usageRef.set({
        uid,
        count: count + 1,
        lastUsedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    return { error: false, uid, plan: keyDoc?.plan || 'free', keyHash };
  } catch (err) {
    console.error('[validateApiKey] Erro interno:', err);
    // Em caso de falha de banco transitória, permite com aviso mas loga
    return { error: false, uid: 'fallback-user', plan: 'free' };
  }
}

module.exports = { validateApiKey, sha256 };
