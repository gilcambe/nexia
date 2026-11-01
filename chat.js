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
        // Fallback transparente para nuvem se a IA local falhar
        return await enviarParaNuvem(prompt, opcoes, true);
      },
      onProgress: opcoes.onProgress,
      modelo: configIA.modelo,
    });

    // Se a resposta for da IA local, não for vazia e não tiver erro, registrar como 'tokens no aparelho'
    if (resultadoLocal.origem === 'local' && resultadoLocal.resposta && !resultadoLocal.erro) {
      // Registrar uso bem-sucedido no placar como 'tokens no aparelho' (sem descontar cota do plano)
      atualizarPlacarTokens({
        tipo: 'tokens no aparelho',
        tokens: calcularTokens(mensagem.texto, resultadoLocal.resposta),
      });

      return {
        resposta: resultadoLocal.resposta,
        origem: 'local',
      };
    }

    // Se houve erro local, timeout ou resposta vazia, retorna o resultado do fallback da nuvem
    // (que já foi processado com ehFallback=true, sem registrar no placar)
    if (resultadoLocal.origem === 'nuvem') {
      return resultadoLocal;
    }
    
    // Se a resposta local foi vazia ou com erro, forçar fallback para nuvem
    if (resultadoLocal.origem === 'local' && (!resultadoLocal.resposta || resultadoLocal.erro)) {
      return await enviarParaNuvem(mensagem.texto, opcoes, true);
    }
  }

  // Se não é simples ou a IA local não está ativa, envia para a nuvem diretamente
  return await enviarParaNuvem(mensagem.texto, opcoes, false);
}

// Função para enviar a mensagem para a nuvem
async function enviarParaNuvem(texto, opcoes, ehFallback = false) {
  const respostaNuvem = await fetch('/api/cortex', {
    method: 'POST',
    body: JSON.stringify({ texto, ...opcoes }),
  });

  const dados = await respostaNuvem.json();

  // Registrar uso no placar de tokens (descontando cota do plano), a menos que seja um fallback silencioso
  if (!ehFallback) {
    atualizarPlacarTokens({
      tipo: 'nuvem',
      tokens: calcularTokens(texto, dados.resposta),
    });
  }

  return {
    resposta: dados.resposta,
    origem: 'nuvem',
  };
}

// Função para calcular tokens
function calcularTokens(textoEntrada, textoSaida) {
  return (textoEntrada.length + textoSaida.length) / 4;
}

export { despacharMensagem };
