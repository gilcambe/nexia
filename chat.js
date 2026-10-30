import { executarPromptComFallback, obterConfig } from './ia-local.js';
import { atualizarPlacarTokens } from './placar-tokens.js';

// Função para classificar se a pergunta é simples
function ehPerguntaSimples(mensagem) {
  // Critérios para pergunta simples: sem anexos, sem ferramentas, sem busca
  return !mensagem.anexos && !mensagem.ferramentas && !mensagem.busca;
}

// Função para despachar a mensagem para a IA local ou nuvem
async function despacharMensagem(mensagem, opcoes = {}) {
  const configIA = obterConfig();
  const ehSimples = ehPerguntaSimples(mensagem);

  if (configIA.ativo && ehSimples) {
    // Tentar IA local primeiro
    const resultadoLocal = await executarPromptComFallback(mensagem.texto, {
      fallbackNuvem: async (prompt) => {
        // Fallback para nuvem se a IA local falhar
        return await enviarParaNuvem(prompt, opcoes);
      },
      onProgress: opcoes.onProgress,
      modelo: configIA.modelo,
    });

    if (resultadoLocal.origem === 'local' && resultadoLocal.resposta) {
      // Registrar uso no placar de tokens (sem descontar cota do plano)
      atualizarPlacarTokens({
        tipo: 'local',
        tokens: calcularTokens(mensagem.texto, resultadoLocal.resposta),
      });

      return {
        resposta: resultadoLocal.resposta,
        origem: 'local',
      };
    }

    // Se a IA local falhou, tenta a nuvem
    if (resultadoLocal.origem === 'nuvem') {
      return resultadoLocal;
    }
  }

  // Se não é simples ou a IA local não está ativa, envia para a nuvem
  return await enviarParaNuvem(mensagem.texto, opcoes);
}

// Função para enviar a mensagem para a nuvem (já existente, supondo)
async function enviarParaNuvem(texto, opcoes) {
  // Lógica para enviar para a nuvem (já existente)
  const respostaNuvem = await fetch('/api/nuvem', {
    method: 'POST',
    body: JSON.stringify({ texto, ...opcoes }),
  });

  const dados = await respostaNuvem.json();

  // Registrar uso no placar de tokens (descontando cota do plano)
  atualizarPlacarTokens({
    tipo: 'nuvem',
    tokens: calcularTokens(texto, dados.resposta),
  });

  return {
    resposta: dados.resposta,
    origem: 'nuvem',
  };
}

// Função para calcular tokens (supondo que exista)
function calcularTokens(textoEntrada, textoSaida) {
  // Lógica para calcular tokens (já existente ou a ser implementada)
  return (textoEntrada.length + textoSaida.length) / 4; // Exemplo simplificado
}

export { despacharMensagem };
