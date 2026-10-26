'use strict';
// #831 (Melhoria C13): modos "Rápido / Pensar / Pesquisar" do composer do Cortex. Tudo grátis.
//   rapido    → modelo pequeno e rápido (Groq GPT-OSS 20B), sem o passo do orquestrador
//   pensar    → modelo de raciocínio (cadeia grátis de reasoning)
//   pesquisar → busca na web sem chave (DuckDuckGo, Google News RSS e Wikipédia) e o modelo lê os resultados

const MODOS = Object.freeze({
  rapido: { intent: 'fast', maxTokens: 2048 },
  pensar: { intent: 'reasoning', maxTokens: 0 },
  pesquisar: { intent: 'analysis', maxTokens: 0, web: true },
});

const modoValido = m => (Object.prototype.hasOwnProperty.call(MODOS, m) ? m : null);

const buscaWebEngine = require('../../lib/busca-web');

/** Resultados da web (grátis, sem chave). Devolve o contexto formatado da busca. */
async function buscarWeb(pergunta, fetchImpl = fetch, ms = 4000) {
  try {
    const res = await buscaWebEngine.buscar(pergunta, { fetchImpl, max: 5, ms });
    return res.contexto || buscaWebEngine.contexto([]);
  } catch {
    return buscaWebEngine.contexto([]);
  }
}

module.exports = { MODOS, modoValido, buscarWeb };
