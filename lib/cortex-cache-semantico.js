// lib/cortex-cache-semantico.js
// Cache semântico para mensagens do Cortex.
// - Verifica resposta similar cacheada (similaridade >= 0.92) antes de chamar IA.
// - Salva no cache após resposta da IA apenas se usuario nao marcou como ruim e pergunta for geral.
// - Falhas do Vectorize/Workers AI pulam o cache sem gerar erro.
// - Placar: acertos do cache e tokens economizados.

const SIMILARIDADE_MINIMA = 0.92;

// Estado em memoria (substituir por Vectorize/Workers AI em producao).
const cache = []; // { pergunta, resposta, embedding, geral, marcaRuim, tokensEconomizados }
let placar = { acertosCache: 0, tokensEconomizados: 0 };

// Funcao placeholder de embedding (substituir por Workers AI Vectorize real).
async function gerarEmbedding(texto) {
  try {
    // Aqui seria a chamada ao Vectorize/Workers AI.
    // Em caso de falha, retorna null para pular o cache sem quebrar a requisicao.
    const vetor = texto
      .toLowerCase()
      .split(/[\s,.;:!?]+/)
      .filter(Boolean)
      .map((palavra, i) => palavra.length / (i + 1));
    return vetor;
  } catch (erro) {
    console.warn('[cortex-cache-semantico] falha ao gerar embedding, pulando cache:', erro.message);
    return null;
  }
}

function similaridadeCoseno(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let produtoInterno = 0;
  let normaA = 0;
  let normaB = 0;
  for (let i = 0; i < a.length; i++) {
    produtoInterno += a[i] * b[i];
    normaA += a[i] * a[i];
    normaB += b[i] * b[i];
  }
  if (normaA === 0 || normaB === 0) return 0;
  return produtoInterno / (Math.sqrt(normaA) * Math.sqrt(normaB));
}

// Busca resposta similar cacheada.
// Retorna { achou, resposta, tokensEconomizados } ou { achou: false }.
async function buscarRespostaCacheada(pergunta) {
  try {
    const embedding = await gerarEmbedding(pergunta);
    if (!embedding) return { achou: false };

    let melhor = null;
    let melhorSimilaridade = 0;

    for (const item of cache) {
      if (!item.embedding) continue;
      const sim = similaridadeCoseno(embedding, item.embedding);
      if (sim > melhorSimilaridade) {
        melhorSimilaridade = sim;
        melhor = item;
      }
    }

    if (melhor && melhorSimilaridade >= SIMILARIDADE_MINIMA && !melhor.marcaRuim) {
      placar.acertosCache += 1;
      placar.tokensEconomizados += melhor.tokensEconomizados || 0;
      return {
        achou: true,
        resposta: melhor.resposta,
        similaridade: melhorSimilaridade,
        tokensEconomizados: melhor.tokensEconomizados || 0,
      };
    }

    return { achou: false };
  } catch (erro) {
    console.warn('[cortex-cache-semantico] falha ao buscar cache, pulando:', erro.message);
    return { achou: false };
  }
}

// Salva resposta no cache apos a IA responder.
// Salva apenas se usuario nao marcou como ruim e a pergunta for geral.
async function salvarNoCache(pergunta, resposta, opts = {}) {
  try {
    const { geral = false, marcaRuim = false, tokensEconomizados = 0 } = opts;

    // Nao salva se nao for pergunta geral ou se usuario marcou como ruim.
    if (!geral || marcaRuim) return false;

    const embedding = await gerarEmbedding(pergunta);
    if (!embedding) return false;

    cache.push({
      pergunta,
      resposta,
      embedding,
      geral,
      marcaRuim,
      tokensEconomizados,
      criadoEm: Date.now(),
    });

    return true;
  } catch (erro) {
    console.warn('[cortex-cache-semantico] falha ao salvar cache, pulando:', erro.message);
    return false;
  }
}

// Marca um item do cache como ruim (usuario nao gostou).
function marcarComoRuim(pergunta) {
  for (const item of cache) {
    if (item.pergunta === pergunta) {
      item.marcaRuim = true;
      return true;
    }
  }
  return false;
}

// Retorna o placar atual.
function obterPlacar() {
  return {
    acertosCache: placar.acertosCache,
    tokensEconomizados: placar.tokensEconomizados,
  };
}

// Reseta o placar (uso em testes).
function resetarPlacar() {
  placar = { acertosCache: 0, tokensEconomizados: 0 };
}

// Limpa o cache (uso em testes).
function limparCache() {
  cache.length = 0;
}

module.exports = {
  SIMILARIDADE_MINIMA,
  gerarEmbedding,
  buscarRespostaCacheada,
  salvarNoCache,
  marcarComoRuim,
  obterPlacar,
  resetarPlacar,
  limparCache,
};
