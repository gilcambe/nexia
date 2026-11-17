(function () {
  'use strict';
  const MB = window.MB = window.MB || {};

  function ehLeitura(acao) {
    return acao.endsWith('_listar') ||
           acao.endsWith('_resumo') ||
           acao.endsWith('_visao') ||
           acao.endsWith('_status') ||
           acao.endsWith('_previsao') ||
           acao.endsWith('_ver') ||
           acao.endsWith('_estado') ||
           acao === 'avisos' ||
           acao === 'relatorio_mensal' ||
           acao === 'saude_financeira' ||
           acao === 'meu_plano';
  }

  function criarCacheApi(apiReal, opcoes) {
    opcoes = opcoes || {};
    const agora = opcoes.agora || Date.now;
    const ttlMs = opcoes.ttlMs !== undefined ? opcoes.ttlMs : 60000;
    const MAX_GUARDADOS = 60;

    const guardados = new Map(); // chave -> { resposta, tempo }
    const voando = new Map(); // chave -> promessa em voo

    function limpar() {
      guardados.clear();
      voando.clear();
    }

    function chaveDe(acao, dados) {
      return acao + JSON.stringify(dados || {});
    }

    async function api(acao, dados) {
      if (ehLeitura(acao)) {
        const chave = chaveDe(acao, dados);
        const agoraMs = agora();
        const guardado = guardados.get(chave);
        if (guardado && agoraMs - guardado.tempo < ttlMs) {
          return guardado.resposta;
        }
        const voo = voando.get(chave);
        if (voo) return voo;
        const promessa = (async () => {
          try {
            const resposta = await apiReal(acao, dados);
            guardados.set(chave, { resposta, tempo: agora() });
            if (guardados.size > MAX_GUARDADOS) {
              const maisVelha = guardados.keys().next().value;
              guardados.delete(maisVelha);
            }
            return resposta;
          } finally {
            voando.delete(chave);
          }
        })();
        voando.set(chave, promessa);
        return promessa;
      }
      try {
        return await apiReal(acao, dados);
      } finally {
        limpar();
      }
    }

    api.limpar = limpar;
    return api;
  }

  MB.criarCacheApi = criarCacheApi;
})();
