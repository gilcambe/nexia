// lib/cortex-venda.js
// Fluxo de processamento de mensagens do Cortex com cache semantico.
// Integra lib/cortex-cache-semantico.js:
// - Verifica resposta similar cacheada (similaridade >= 0.92) antes de chamar IA.
// - Salva no cache apos resposta da IA apenas se usuario nao marcou como ruim e pergunta for geral.
// - Conversas com historico nunca usam o cache.
// - Falhas do Vectorize/Workers AI pulam o cache sem gerar erro.

const cache = require('./cortex-cache-semantico');

// Placeholder: chamada real de IA do Cortex (substituir por Workers AI / modelo real).
async function chamarIA(pergunta, historico) {
  try {
    // Aqui seria a chamada ao modelo de IA.
    // Retorna { resposta, tokensUsados }
    const resposta = `Resposta da IA para: "${pergunta}"`;
    return { resposta, tokensUsados: resposta.length };
  } catch (erro) {
    console.warn('[cortex-venda] falha ao chamar IA:', erro.message);
    throw erro;
  }
}

// Verifica se a conversa tem historico (nao eh primeira mensagem).
function temHistorico(historico) {
  return Array.isArray(historico) && historico.length > 0;
}

// Processa uma mensagem do usuario.
// Retorna { resposta, doCache, similaridade, tokensEconomizados, tokensUsados, placar }
async function processarMensagem({ pergunta, historico = [], geral = true, marcaRuim = false }) {
  const placarAntes = cache.obterPlacar();

  // Conversas com historico nunca usam o cache.
  if (temHistorico(historico)) {
    const ia = await chamarIA(pergunta, historico);
    await cache.salvarNoCache(pergunta, ia.resposta, { geral, marcaRuim, tokensEconomizados: ia.tokensUsados });
    return {
      resposta: ia.resposta,
      doCache: false,
      similaridade: 0,
      tokensEconomizados: 0,
      tokensUsados: ia.tokensUsados,
      placar: cache.obterPlacar(),
    };
  }

  // Pergunta geral sem historico: tenta cache primeiro.
  if (geral) {
    const resultadoCache = await cache.buscarRespostaCacheada(pergunta);
    if (resultadoCache.achou) {
      return {
        resposta: resultadoCache.resposta,
        doCache: true,
        similaridade: resultadoCache.similaridade,
        tokensEconomizados: resultadoCache.tokensEconomizados,
        tokensUsados: 0,
        placar: cache.obterPlacar(),
      };
    }
  }

  // Nao achou no cache: chama IA.
  const ia = await chamarIA(pergunta, historico);
  await cache.salvarNoCache(pergunta, ia.resposta, { geral, marcaRuim, tokensEconomizados: ia.tokensUsados });

  return {
    resposta: ia.resposta,
    doCache: false,
    similaridade: 0,
    tokensEconomizados: 0,
    tokensUsados: ia.tokensUsados,
    placar: cache.obterPlacar(),
  };
}

module.exports = {
  processarMensagem,
  chamarIA,
  temHistorico,
};
