// lib/cortex-cache-semantico.js
// Cache semântico para mensagens do Cortex.
// - Verifica resposta similar cacheada (similaridade >= 0.92) antes de chamar IA.
// - Salva no cache após resposta da IA apenas se usuario nao marcou como ruim e pergunta for geral.
// - Falhas do Vectorize/Workers AI pulam o cache sem gerar erro.
// - Placar: acertos do cache e tokens economizados.

const SIMILARIDADE_MINIMA = 0.92;

// Estado em memoria (substituir por Vectorize/Workers AI em producao).
// Isolado por usuario/tenant: cache[usuarioId][tenantId] = [].
// Cada usuario/tenant so ve seus proprios itens de cache, evitando vazamento de dados entre conversas.
const cache = {}; // { [usuarioId]: { [tenantId]: [] } }
const placar = {}; // { [usuarioId]: { [tenantId]: { acertosCache, tokensEconomizados } } };

// Limite de tamanho para evitar esgotamento de memoria (DoS).
const TAMANHO_MAXIMO_PERGUNTA = 2000;
const TAMANHO_MAXIMO_RESPOSTA = 4000;
const MAX_ITENS_POR_USUARIO_TENANT = 500;

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
// Isolada por usuario/tenant: so itens do proprio usuario/tenant sao considerados.
// Retorna { achou, resposta, tokensEconomizados } ou { achou: false }.
async function buscarRespostaCacheada(pergunta, opts = {}) {
  try {
    const { usuarioId = 'anonimo', tenantId = 'default' } = opts;
    const embedding = await gerarEmbedding(pergunta);
    if (!embedding) return { achou: false };

    const itens = (cache[usuarioId] && cache[usuarioId][tenantId]) || [];
    let melhor = null;
    let melhorSimilaridade = 0;

    for (const item of itens) {
      if (!item.embedding) continue;
      const sim = similaridadeCoseno(embedding, item.embedding);
      if (sim > melhorSimilaridade) {
        melhorSimilaridade = sim;
        melhor = item;
      }
    }

    if (melhor && melhorSimilaridade >= SIMILARIDADE_MINIMA && !melhor.marcaRuim) {
      const p = garantirPlacar(usuarioId, tenantId);
      p.acertosCache += 1;
      p.tokensEconomizados += melhor.tokensEconomizados || 0;
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

// Garante (ou cria) o placar isolado por usuario/tenant.
function garantirPlacar(usuarioId, tenantId) {
  if (!placar[usuarioId]) placar[usuarioId] = {};
  if (!placar[usuarioId][tenantId]) {
    placar[usuarioId][tenantId] = { acertosCache: 0, tokensEconomizados: 0 };
  }
  return placar[usuarioId][tenantId];
}

// Salva resposta no cache apos a IA responder.
// Salva apenas se usuario nao marcou como ruim e a pergunta for geral.
// Limite de tamanho para evitar esgotamento de memoria (DoS).
async function salvarNoCache(pergunta, resposta, opts = {}) {
  try {
    const { usuarioId = 'anonimo', tenantId = 'default', geral = false, marcaRuim = false, tokensEconomizados = 0 } = opts;

    // Nao salva se nao for pergunta geral ou se usuario marcou como ruim.
    if (!geral || marcaRuim) return false;

    // Limite de tamanho para evitar esgotamento de memoria (DoS).
    if (!pergunta || pergunta.length > TAMANHO_MAXIMO_PERGUNTA) return false;
    if (!resposta || resposta.length > TAMANHO_MAXIMO_RESPOSTA) return false;

    const embedding = await gerarEmbedding(pergunta);
    if (!embedding) return false;

    if (!cache[usuarioId]) cache[usuarioId] = {};
    if (!cache[usuarioId][tenantId]) cache[usuarioId][tenantId] = [];

    // Limite de itens por usuario/tenant (remove o mais antigo se exceder).
    const itens = cache[usuarioId][tenantId];
    if (itens.length >= MAX_ITENS_POR_USUARIO_TENANT) {
      itens.shift();
    }

    itens.push({
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
function marcarComoRuim(pergunta, opts = {}) {
  const { usuarioId = 'anonimo', tenantId = 'default' } = opts;
  const itens = (cache[usuarioId] && cache[usuarioId][tenantId]) || [];
  for (const item of itens) {
    if (item.pergunta === pergunta) {
      item.marcaRuim = true;
      return true;
    }
  }
  return false;
}

// Retorna o placar atual isolado por usuario/tenant.
function obterPlacar(opts = {}) {
  const { usuarioId = 'anonimo', tenantId = 'default' } = opts;
  const p = (placar[usuarioId] && placar[usuarioId][tenantId]) || { acertosCache: 0, tokensEconomizados: 0 };
  return {
    acertosCache: p.acertosCache,
    tokensEconomizados: p.tokensEconomizados,
  };
}

// Reseta o placar (uso em testes).
function resetarPlacar(opts = {}) {
  const { usuarioId = 'anonimo', tenantId = 'default' } = opts;
  if (placar[usuarioId]) {
    placar[usuarioId][tenantId] = { acertosCache: 0, tokensEconomizados: 0 };
  }
}

// Limpa o cache (uso em testes).
function limparCache(opts = {}) {
  const { usuarioId = 'anonimo', tenantId = 'default' } = opts;
  if (cache[usuarioId] && cache[usuarioId][tenantId]) {
    cache[usuarioId][tenantId] = [];
  }
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
  garantirPlacar,
};
