// api/chat.js
// Endpoint de chat do Cortex.
// Integra o cache semantico e exibe o placar (acertosCache, tokensEconomizados).

const cortexVenda = require('../lib/cortex-venda');

// Handler no formato Netlify: exports.handler = async (event, context) => { ... }
exports.handler = async (event) => {
  // Apenas permite POST.
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ erro: 'Metodo nao permitido. Use POST.' }),
    };
  }

  let corpo;
  try {
    corpo = JSON.parse(event.body || '{}');
  } catch (erro) {
    return {
      statusCode: 400,
      body: JSON.stringify({ erro: 'Corpo JSON invalido.' }),
    };
  }

  const { pergunta, historico = [], geral = true, marcaRuim = false } = corpo;

  if (!pergunta || typeof pergunta !== 'string') {
    return {
      statusCode: 400,
      body: JSON.stringify({ erro: 'Pergunta e obrigatoria.' }),
    };
  }

  try {
    const resultado = await cortexVenda.processarMensagem({
      pergunta,
      historico,
      geral,
      marcaRuim,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resposta: resultado.resposta,
        doCache: resultado.doCache,
        similaridade: resultado.similaridade,
        tokensEconomizados: resultado.tokensEconomizados,
        tokensUsados: resultado.tokensUsados,
        placar: resultado.placar,
      }),
    };
  } catch (erro) {
    console.error('[api/chat] erro ao processar mensagem:', erro.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ erro: 'Erro interno ao processar mensagem.' }),
    };
  }
};
