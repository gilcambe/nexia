
'use strict';

const modelRouter = require('../model-router');
const { AI_CATALOG, chain, callChain, labelOf } = require('../../netlify/functions/cortex-chat'); // Importa o AI_CATALOG e funções necessárias do cortex-chat

const REASONING_MODELS = ['groq_llama4_maverick', 'or_deepseek_r1', 'or_qwen3_235b', 'groq_qwen', 'or_gpt_oss_120b']; // Modelos de raciocínio grátis
const REVIEW_MODEL = 'gemini_25_flash'; // Modelo de conferência

const MAX_TURNS = 2; // Máximo de 2 voltas de correção
const TOTAL_TIMEOUT_MS = 40000; // Prazo total de 40 segundos

/**
 * Converte um texto para JSON de forma segura.
 * @param {string} text
 * @returns {object|null}
 */
function safeJSON(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

/**
 * Roda a lógica de pensamento com autocorreção.
 * @param {string} systemPrompt - Prompt de sistema para o modelo de raciocínio.
 * @param {Array<object>} messages - Histórico de mensagens.
 * @param {string} userMessage - A mensagem atual do usuário.
 * @returns {Promise<object>} - Objeto com a resposta final e o log de pensamento.
 */
async function pensar(systemPrompt, messages, userMessage) {
  const startTime = Date.now();
  const thoughtProcess = [];
  let currentResponse = '';
  let finalConfidence = 'alta';

  // Define os modelos a serem usados. Garante que os modelos estão configurados e disponíveis.
  const reasoningModels = chain(...REASONING_MODELS);
  const reviewModelKey = chain(REVIEW_MODEL)[0]; // Pega o primeiro modelo disponível para revisão

  if (!reasoningModels.length) {
    return {
      reply: '❌ Nenhuma IA de raciocínio configurada ou disponível.',
      thoughtProcess: [{ step: 'Erro', description: 'Nenhuma IA de raciocínio configurada ou disponível.' }],
      confidence: 'baixa',
    };
  }
  if (!reviewModelKey) {
    return {
      reply: '❌ Nenhuma IA de conferência configurada ou disponível.',
      thoughtProcess: [{ step: 'Erro', description: 'Nenhuma IA de conferência configurada ou disponível.' }],
      confidence: 'baixa',
    };
  }

  // Adiciona a mensagem do usuário ao contexto para os modelos
  const fullCtx = [...messages, { role: 'user', content: userMessage }];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const elapsed = Date.now() - startTime;
    if (elapsed >= TOTAL_TIMEOUT_MS) {
      thoughtProcess.push({ step: `Volta ${turn + 1}: Timeout`, description: `Prazo total de ${TOTAL_TIMEOUT_MS / 1000}s atingido.` });
      finalConfidence = 'baixa';
      break;
    }

    let thinkingModelLabel = '';
    let reviewModelLabel = '';

    // 1. Plano e Resposta (modelo de raciocínio)
    let planAndResponse = '';
    try {
      // Usar callChain para tentar modelos de raciocínio
      const { text, key } = await callChain(systemPrompt, fullCtx, reasoningModels, 8192);
      planAndResponse = text;
      thinkingModelLabel = labelOf(AI_CATALOG[key].provider, AI_CATALOG[key].model);
      thoughtProcess.push({
        step: `Volta ${turn + 1}: Plano e Resposta (modelo ${thinkingModelLabel})`,
        description: `Resposta inicial gerada.`,
        content: planAndResponse
      });
    } catch (e) {
      const errorMsg = `Erro ao gerar plano e resposta: ${e.message}`;
      thoughtProcess.push({ step: `Volta ${turn + 1}: Erro`, description: errorMsg });
      currentResponse = `❌ Erro de raciocínio: ${errorMsg}`;
      finalConfidence = 'baixa';
      break;
    }

    // 2. Conferência (segundo modelo)
    let reviewResult = { ok: false, error: 'Falha na conferência.' };
    try {
      const reviewPrompt = `Você é um avaliador imparcial. Analise a PERGUNTA e a RESPOSTA e retorne um JSON no formato {"ok": true|false, "erro": "Mensagem de erro se ok for false"}. Se a resposta for boa, retorne {"ok": true}. Se houver algum erro de lógica, dados incorretos, ou se a resposta for incompleta para a pergunta, retorne {"ok": false, "erro": "Descreva o erro aqui."}.\n\nPERGUNTA:\n${userMessage}\n\nRESPOSTA:\n${planAndResponse}\n`;
      const { text: reviewRaw, key: reviewUsedKey } = await callChain(null, [{ role: 'user', content: reviewPrompt }], [reviewModelKey], 1024);
      reviewResult = safeJSON(reviewRaw);
      reviewModelLabel = labelOf(AI_CATALOG[reviewUsedKey].provider, AI_CATALOG[reviewUsedKey].model);

      if (!reviewResult) {
        reviewResult = { ok: false, error: `Resposta do avaliador inválida ou não JSON: ${reviewRaw}` };
      }

      thoughtProcess.push({
        step: `Volta ${turn + 1}: Conferência (modelo ${reviewModelLabel})`,
        description: reviewResult.ok ? 'Conferido com sucesso.' : `Erro encontrado: ${reviewResult.error}`,
        result: reviewResult
      });
    } catch (e) {
      const errorMsg = `Erro na conferência: ${e.message}`;
      thoughtProcess.push({ step: `Volta ${turn + 1}: Erro na Conferência`, description: errorMsg });
      reviewResult = { ok: false, error: errorMsg };
    }

    if (reviewResult.ok) {
      currentResponse = planAndResponse;
      thoughtProcess.push({ step: `Volta ${turn + 1}: Finalizado`, description: 'Resposta confirmada pela conferência.' });
      break; // Resposta aprovada, sai do loop
    } else if (turn < MAX_TURNS - 1) {
      // 3. Refazer (mandar erro de volta ao 1º modelo)
      const correctionPrompt = `A sua resposta anterior foi:\n${planAndResponse}\n\nNo entanto, a conferência encontrou o seguinte erro: "${reviewResult.error}".\nPor favor, corrija a resposta, levando em conta o erro apontado, e gere uma nova resposta completa, com os passos revisados.`;

      // Adiciona o prompt de correção ao contexto para o modelo de raciocínio
      fullCtx.push({ role: 'assistant', content: planAndResponse });
      fullCtx.push({ role: 'user', content: correctionPrompt });
      thoughtProcess.push({ step: `Volta ${turn + 1}: Correção`, description: `Pedindo correção ao modelo de raciocínio: "${reviewResult.error}"` });
      finalConfidence = 'baixa'; // Se houve erro, a confiança diminui
    } else {
      // Última volta e falhou
      currentResponse = planAndResponse;
      thoughtProcess.push({ step: `Volta ${turn + 1}: Falha Final`, description: `Após ${MAX_TURNS} voltas, a correção falhou. Entregando a melhor resposta com confiança baixa.` });
      finalConfidence = 'baixa';
    }
  }

  // Se nenhuma resposta foi gerada, ou se falhou em todas as voltas sem resposta
  if (!currentResponse) {
    currentResponse = 'Não foi possível gerar uma resposta satisfatória após múltiplas tentativas.';
    finalConfidence = 'baixa';
  }

  return {
    reply: currentResponse,
    thoughtProcess: thoughtProcess,
    confidence: finalConfidence,
  };
}

module.exports = { pensar };
