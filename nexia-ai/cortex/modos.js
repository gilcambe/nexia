'use strict';
// #831 (Melhoria C13): modos "Rápido / Pensar / Pesquisar" do composer do Cortex. Tudo grátis.
//   rapido    → modelo pequeno e rápido (Groq GPT-OSS 20B), sem o passo do orquestrador
//   pensar    → modelo de raciocínio (cadeia grátis de reasoning)
//   pesquisar → busca na web sem chave (DuckDuckGo, Google News RSS, Wikipédia e cotação de moedas) e o modelo lê os resultados

const MODOS = Object.freeze({
  rapido: { intent: 'fast', maxTokens: 2048 },
  pensar: { intent: 'reasoning', maxTokens: 0 },
  pesquisar: { intent: 'analysis', maxTokens: 0, web: true },
});

const modoValido = m => (Object.prototype.hasOwnProperty.call(MODOS, m) ? m : null);

const buscaWebEngine = require('../../lib/busca-web');

/** Resultados da web (grátis, sem chave). Devolve o contexto formatado da busca. */
async function buscarWeb(pergunta, fetchImpl = fetch, ms = 4000) {
  const resultado = await buscarWebDetalhe(pergunta, fetchImpl, ms);
  if (!resultado.contexto || resultado.contexto.trim() === '') {
    return 'Não encontrei fontes agora. NUNCA invente notícias, leis, estatísticas ou fontes.';
  }
  return resultado.contexto;
}

/** Igual a buscarWeb, mais quantas fontes cada serviço trouxe (porFonte). */
async function buscarWebDetalhe(pergunta, fetchImpl = fetch, ms = 4000) {
  // #1733: cada fonte tem o próprio prazo dentro de busca-web (antes um prazo só para todas fazia a busca voltar vazia).
  try {
    const res = await buscaWebEngine.buscar(pergunta, { fetchImpl, max: 6, ms });
    return { contexto: res.contexto || '', porFonte: res.porFonte || {} };
  } catch {
    return { contexto: buscaWebEngine.contexto([]), porFonte: {} };
  }
}

module.exports = { MODOS, modoValido, buscarWeb, buscarWebDetalhe };
