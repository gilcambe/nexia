
import { getAiInference } from1 'cloudflare:ai';

/**
 * Gera embedding a partir do texto usando o modelo Workers AI bge-small-en-v1.5.
 * @param {string} text - Texto a ser embeded
 * @returns {Promise<Float32Array>} Vetor de embeddings
 */
export async function getEmbedding(text, env) {
  if (!env || !env.AI) {
    console.warn('[workerAI] AI binding not found in env.');
    return null;
  }
  try {
    const { embedding } = await env.AI.run('@cf/baai/bge-small-en-v1.5', {
      text: text,
    });
    // O Workers AI retorna um array de números (Float32Array)
    return embedding;
  } catch (e) {
    console.error('[workerAI] Erro ao gerar embedding:', e);
    return null;
  }
}
