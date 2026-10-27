// lib/cortex-cache-semantico.js
// Cache semântico para perguntas gerais do Cortex.
// Usa Cloudflare Workers AI (@cf/baai/bge-m3) para gerar vetores,
// com fallback silencioso e similaridade de cosseno em JS.
// Ligado apenas quando CORTEX_CACHE_SEMANTICO=1.

const ENABLED = process.env.CORTEX_CACHE_SEMANTICO === "1";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const MAX_ITEMS = 2000; // limite D1/Vectorize fallback
const SIMILARIDADE_MINIMA = 0.92;

// Memória em cache (fallback quando não há D1/Vectorize)
// Estrutura: { [tenantId]: [{ pergunta, vetor, resposta, createdAt }] }
const cacheMemoria = {};

// -----------------------------
// Validação de elegibilidade
// -----------------------------

function ehPerguntaGeral(contexto) {
  if (!contexto) return false;
  // Sem histórico, sem dado pessoal, sem anexo, sem ferramenta
  if (contexto.historico && contexto.historico.length > 0) return false;
  if (contexto.dadoPessoal) return false;
  if (contexto.anexo) return false;
  if (contexto.ferramenta) return false;
  if (!contexto.pergunta || typeof contexto.pergunta !== "string") return false;
  return true;
}

function chaveTenant(contexto) {
  return (contexto && contexto.tenantId) || "default";
}

function estaValido(item) {
  return Date.now() - item.createdAt < TTL_MS;
}

// -----------------------------
// Geração de vetor (Cloudflare Workers AI)
// -----------------------------

async function gerarVetor(texto) {
  if (!ENABLED) return null;
  try {
    const url = "https://api.cloudflare.com/client/v4/accounts/{{CLOUDFLARE_AI_ACCOUNT_ID}}/ai/run/@cf/baai/bge-m3";
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.CLOUDFLARE_AI_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text: texto })
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data || !data.result || !data.result.data) return null;
    return data.result.data;
  } catch (_) {
    // Tratamento de erro silencioso
    return null;
  }
}

// -----------------------------
// Similaridade de cosseno (JS)
// -----------------------------

function similaridadeCosseno(vetorA, vetorB) {
  if (!vetorA || !vetorB || vetorA.length !== vetorB.length) return 0;
  let ponto = 0;
  let normaA = 0;
  let normaB = 0;
  for (let i = 0; i < vetorA.length; i++) {
    ponto += vetorA[i] * vetorB[i];
    normaA += vetorA[i] * vetorA[i];
    normaB += vetorB[i] * vetorB[i];
  }
  normaA = Math.sqrt(normaA);
  normaB = Math.sqrt(normaB);
  if (normaA === 0 || normaB === 0) return 0;
  return ponto / (normaA * normaB);
}

// -----------------------------
// Busca no cache
// -----------------------------

async function buscarCache(contexto) {
  if (!ENABLED || !ehPerguntaGeral(contexto)) return null;
  const tenant = chaveTenant(contexto);
  const itens = (cacheMemoria[tenant] || []).filter(estaValido);
  if (itens.length === 0) return null;

  const vetor = await gerarVetor(contexto.pergunta);
  if (!vetor) return null;

  let melhor = null;
  let melhorSim = 0;
  for (const item of itens) {
    const sim = similaridadeCosseno(vetor, item.vetor);
    if (sim > melhorSim && sim >= SIMILARIDADE_MINIMA) {
      melhorSim = sim;
      melhor = item;
    }
  }
  return melhor;
}

// -----------------------------
// Grava no cache
// -----------------------------

function gravarCache(contexto, resposta) {
  if (!ENABLED || !ehPerguntaGeral(contexto)) return false;
  const tenant = chaveTenant(contexto);
  if (!cacheMemoria[tenant]) cacheMemoria[tenant] = [];

  const itens = cacheMemoria[tenant].filter(estaValido);
  if (itens.length >= MAX_ITEMS) return false; // limite

  cacheMemoria[tenant].push({
    pergunta: contexto.pergunta,
    vetor: contexto.vetor || null,
    resposta,
    createdAt: Date.now()
  });
  return true;
}

// -----------------------------
// Limpeza de itens expirados
// -----------------------------

function limparExpirados() {
  for (const tenant of Object.keys(cacheMemoria)) {
    cacheMemoria[tenant] = (cacheMemoria[tenant] || []).filter(estaValido);
  }
}

setInterval(limparExpirados, 60 * 60 * 1000); // a cada hora

module.exports = {
  ENABLED,
  ehPerguntaGeral,
  gerarVetor,
  similaridadeCosseno,
  buscarCache,
  gravarCache,
  limparExpirados,
  TTL_MS,
  MAX_ITEMS,
  SIMILARIDADE_MINIMA
};