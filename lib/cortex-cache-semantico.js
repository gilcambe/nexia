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
  if (!texto || typeof texto !== "string" || texto.length > 4000) return null;
  try {
    const url = "https://api.cloudflare.com/client/v4/accounts/" + process.env.CLOUDFLARE_AI_ACCOUNT_ID + "/ai/run/@cf/baai/bge-m3";
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.CLOUDFLARE_AI_TOKEN}`,
        "Content-Type": "application/json",
        "Origin": process.env.NEXIA_APP_URL ? process.env.NEXIA_APP_URL.split(",")[0].trim() : "https://cloudflare-workers-ai"
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
// Persistência: D1 (até 2000 itens) ou Cloudflare Vectorize
// -----------------------------

function criarStmtD1(db, sql, params) {
  try {
    const stmt = db.prepare(sql);
    if (params && Array.isArray(params)) {
      params.forEach((p) => stmt.bind(p));
    }
    return stmt;
  } catch (_) {
    return null;
  }
}

async function buscarCacheD1(db, tenant, pergunta) {
  if (!db) return null;
  try {
    const vetor = await gerarVetor(pergunta);
    if (!vetor) return null;
    const vetorJson = JSON.stringify(vetor);
    const stmt = criarStmtD1(db,
      "SELECT pergunta, resposta, vetor, createdAt FROM cache_semantico WHERE tenant = ? AND createdAt > ? ORDER BY createdAt DESC LIMIT ?",
      [tenant, Date.now() - TTL_MS, MAX_ITEMS]
    );
    if (!stmt) return null;
    const res = await stmt.all();
    const itens = res.results || [];
    let melhor = null;
    let melhorSim = 0;
    for (const item of itens) {
      const itemVetor = item.vetor ? (typeof item.vetor === "string" ? JSON.parse(item.vetor) : item.vetor) : null;
      if (!itemVetor) continue;
      const sim = similaridadeCosseno(vetor, itemVetor);
      if (sim > melhorSim && sim >= SIMILARIDADE_MINIMA) {
        melhorSim = sim;
        melhor = { pergunta: item.pergunta, resposta: item.resposta, similaridade: sim };
      }
    }
    return melhor;
  } catch (_) {
    return null;
  }
}

async function gravarCacheD1(db, tenant, pergunta, vetor, resposta) {
  if (!db) return false;
  try {
    const stmt = criarStmtD1(db,
      "INSERT INTO cache_semantico (tenant, pergunta, vetor, resposta, createdAt) VALUES (?, ?, ?, ?, ?)",
      [tenant, pergunta, JSON.stringify(vetor), resposta, Date.now()]
    );
    if (!stmt) return false;
    await stmt.run();
    return true;
  } catch (_) {
    return false;
  }
}

async function buscarCacheVectorize(vectorize, tenant, pergunta) {
  if (!vectorize) return null;
  try {
    const vetor = await gerarVetor(pergunta);
    if (!vetor) return null;
    const res = await vectorize.query(vetor, { topK: 10, filter: { tenant } });
    const matches = res.matches || [];
    let melhor = null;
    let melhorSim = 0;
    for (const m of matches) {
      const sim = m.score ?? 0;
      if (sim > melhorSim && sim >= SIMILARIDADE_MINIMA) {
        melhorSim = sim;
        melhor = { pergunta: m.id, resposta: m.metadata && m.metadata.resposta ? m.metadata.resposta : null, similaridade: sim };
      }
    }
    return melhor;
  } catch (_) {
    return null;
  }
}

async function gravarCacheVectorize(vectorize, tenant, pergunta, vetor, resposta) {
  if (!vectorize) return false;
  try {
    await vectorize.upsert([{ id: pergunta, values: vetor, metadata: { tenant, resposta } }]);
    return true;
  } catch (_) {
    return false;
  }
}

// -----------------------------
// Busca no cache (memória -> D1 -> Vectorize)
// -----------------------------

async function buscarCache(contexto, env) {
  if (!ENABLED || !ehPerguntaGeral(contexto)) return null;
  const tenant = chaveTenant(contexto);

  // 1) Memória RAM
  const itens = (cacheMemoria[tenant] || []).filter(estaValido);
  if (itens.length > 0) {
    const vetor = await gerarVetor(contexto.pergunta);
    if (vetor) {
      let melhor = null;
      let melhorSim = 0;
      for (const item of itens) {
        const sim = similaridadeCosseno(vetor, item.vetor);
        if (sim > melhorSim && sim >= SIMILARIDADE_MINIMA) {
          melhorSim = sim;
          melhor = item;
        }
      }
      if (melhor) return melhor;
    }
  }

  // 2) D1 (até 2000 itens)
  const db = env && env.DB ? env.DB : null;
  const resultadoD1 = await buscarCacheD1(db, tenant, contexto.pergunta);
  if (resultadoD1) return resultadoD1;

  // 3) Cloudflare Vectorize
  const vectorize = env && env.VECTORIZE ? env.VECTORIZE : null;
  return buscarCacheVectorize(vectorize, tenant, contexto.pergunta);
}

// -----------------------------
// Grava no cache (memória -> D1 -> Vectorize)
// -----------------------------

async function gravarCache(contexto, resposta, env) {
  if (!ENABLED || !ehPerguntaGeral(contexto)) return false;
  const tenant = chaveTenant(contexto);
  const vetor = await gerarVetor(contexto.pergunta);
  if (!vetor) return false;

  // Memória RAM
  if (!cacheMemoria[tenant]) cacheMemoria[tenant] = [];
  const itens = cacheMemoria[tenant].filter(estaValido);
  if (itens.length >= MAX_ITEMS) return false; // limite
  cacheMemoria[tenant].push({
    pergunta: contexto.pergunta,
    vetor,
    resposta,
    createdAt: Date.now()
  });

  // D1 / Vectorize (erro silencioso, não falha a gravação)
  const db = env && env.DB ? env.DB : null;
  await gravarCacheD1(db, tenant, contexto.pergunta, vetor, resposta);
  const vectorize = env && env.VECTORIZE ? env.VECTORIZE : null;
  await gravarCacheVectorize(vectorize, tenant, contexto.pergunta, vetor, resposta);

  return true;
}

module.exports = {
  ENABLED,
  ehPerguntaGeral,
  gerarVetor,
  similaridadeCosseno,
  buscarCache,
  gravarCache,
  buscarCacheD1,
  gravarCacheD1,
  buscarCacheVectorize,
  gravarCacheVectorize,
  TTL_MS,
  MAX_ITEMS,
  SIMILARIDADE_MINIMA
};
