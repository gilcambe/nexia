import { getAiInference } from '@cf/baai/bge-small-en-v1.5';

/**
 * Gera embedding a partir do texto usando o modelo Workers AI bge-small-en-v1.5.
 * @param {string} text - Texto a ser embeded
 * @returns {Promise<Float32Array>} Vetor de embeddings
 */
export async function getEmbedding(text) {
  const { embedding } = await getAiInference({
    model: 'baai/bge-small-en-v1.5',
    input: text,
  });
  // O Workers AI retorna um array de números (Float32Array)
  return embedding;
}
