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
async function buscarWeb(pergunta, fetchImpl = fetch, ms = 5000) {
  try {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), ms) : null;
    const fetchWithSignal = (url, opts = {}) => fetchImpl(url, ctl ? { ...opts, signal: opts.signal || ctl.signal } : opts);
    try {
      const res = await buscaWebEngine.buscar(pergunta, { fetchImpl: fetchWithSignal, max: 5 });
      return res.contexto || '';
    } finally {
      if (t) clearTimeout(t);
    }
  } catch {
    return 'Resultados da busca na web feita agora:\nNenhuma fonte encontrada na web para esta pesquisa.\nREGRA OBRIGATÓRIA: Diga "não encontrei fontes agora". NUNCA invente notícias, leis, projetos de lei, datas, valores ou links.';
  }
}

module.exports = { MODOS, modoValido, buscarWeb };
