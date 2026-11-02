'use strict';

const { createD1Driver } = require('../../lib/firebase-lite/d1-backend');
const { getWorkerAIEmbedding } = require('../../src/embeddings/workerAI');

const DOC_SEMANTIC_CACHE = 'ia_cota/semantic_cache';

function driverD1(env) {
  if (!env || !env.NEXIA_D1_TOKEN || !env.NEXIA_D1_ACCOUNT_ID) return null;
  return createD1Driver({ token: env.NEXIA_D1_TOKEN, accountId: env.NEXIA_D1_ACCOUNT_ID });
}

function cosseno(v1, v2) {
  if (!v1 || !v2 || v1.length !== v2.length || v1.length === 0) return 0;
  let dot = 0, norm1 = 0, norm2 = 0;
  for (let i = 0; i < v1.length; i++) {
    dot += v1[i] * v2[i];
    norm1 += v1[i] * v1[i];
    norm2 += v2[i] * v2[i];
  }
  const denom = Math.sqrt(norm1) * Math.sqrt(norm2);
  if (denom === 0) return 0;
  return dot / denom;
}

/**
 * Busca no cache semântico (D1) por similaridade de cosseno >= limiar (default 0.92).
 */
async function buscarCacheSemantico(texto, env = process.env, limiar = 0.92) {
  try {
    const d = driverD1(env);
    if (!d || !texto) return null;

    const embeddingQuery = await getWorkerAIEmbedding(texto, env);
    if (!embeddingQuery || !Array.isArray(embeddingQuery)) return null;

    const doc = (await d.get([DOC_SEMANTIC_CACHE])).get(DOC_SEMANTIC_CACHE);
    const itens = (doc && doc.fields && doc.fields.itens) || {};

    let melhorMatch = null;
    let maiorSimilaridade = -1;
    const agora = Date.now();

    for (const [id, item] of Object.entries(itens)) {
      if (!item || (item.ate && item.ate <= agora)) continue;
      if (!item.embedding || !Array.isArray(item.embedding)) continue;

      const sim = cosseno(embeddingQuery, item.embedding);
      if (sim > maiorSimilaridade) {
        maiorSimilaridade = sim;
        melhorMatch = item;
      }
    }

    if (maiorSimilaridade >= limiar && melhorMatch) {
      return { valor: melhorMatch.valor, similaridade: maiorSimilaridade };
    }
    return null;
  } catch (e) {
    console.warn('[semanticCache] erro ao buscar:', e && e.message);
    return null;
  }
}

/**
 * Grava o embedding e a resposta no cache semântico (D1).
 */
async function salvarCacheSemantico(texto, valor, env = process.env, ttlMs = 7 * 24 * 3600e3) {
  try {
    const d = driverD1(env);
    if (!d || !texto || !valor) return false;

    const embedding = await getWorkerAIEmbedding(texto, env);
    if (!embedding || !Array.isArray(embedding)) return false;

    const doc = (await d.get([DOC_SEMANTIC_CACHE])).get(DOC_SEMANTIC_CACHE);
    const itens = (doc && doc.fields && doc.fields.itens) || {};

    const agora = Date.now();
    const id = 'emb_' + Math.random().toString(36).substring(2, 10) + '_' + agora;
    
    itens[id] = {
      embedding,
      valor,
      ate: agora + ttlMs,
      criadoEm: agora
    };

    // Limpar itens expirados ou limitar tamanho (ex: max 200 itens)
    const chaves = Object.keys(itens);
    if (chaves.length > 200) {
      chaves.sort((a, b) => (itens[a].criadoEm || 0) - (itens[b].criadoEm || 0));
      while (chaves.length > 200) {
        delete itens[chaves.shift()];
      }
    }

    const isoNow = new Date().toISOString();
    await d.apply([{
      type: 'upsert',
      path: DOC_SEMANTIC_CACHE,
      fields: { itens },
      create_time: (doc && doc.create_time) || isoNow,
      update_time: isoNow
    }]);

    return true;
  } catch (e) {
    console.warn('[semanticCache] erro ao salvar:', e && e.message);
    return false;
  }
}

module.exports = { buscarCacheSemantico, salvarCacheSemantico, cosseno };
