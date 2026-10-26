
'use strict';

const modelRouter = require('../model-router');
const { AI_CATALOG, chain, callChain, labelOf } = require('../../netlify/functions/cortex-chat');

const REASONING_MODELS = ['groq_llama4_maverick', 'or_deepseek_r1', 'or_qwen3_235b', 'groq_qwen', 'or_gpt_oss_120b'];
const REVIEW_MODEL = 'gemini_25_flash';

const MAX_TURNS = 2;
const TOTAL_TIMEOUT_MS = 40000;

function safeJSON(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

async function pensar(systemPrompt, messages, userMessage) {
  const startTime = Date.now();
  const thoughtProcess = [];
  let currentResponse = '';
  let finalConfidence = 'alta';

  const reasoningModels = chain(...REASONING_MODELS);
  const reviewModelKey = chain(REVIEW_MODEL)[0];

  if (!reasoningModels.length || !reviewModelKey) {
    return {
      reply: '❌ Modelos de raciocínio ou conferência indisponíveis.',
      thoughtProcess: [{ step: 'Erro', description: 'Modelos indisponíveis.' }],
      confidence: 'baixa',
    };
  }

  const fullCtx = [...messages, { role: 'user', content: userMessage }];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    if (Date.now() - startTime >= TOTAL_TIMEOUT_MS) {
      thoughtProcess.push({ step: `Volta ${turn + 1}: Timeout`, description: 'Prazo limite atingido.' });
      finalConfidence = 'baixa';
      break;
    }

    let planAndResponse = '';
    let thinkingModelLabel = '';
    try {
      const { text, key } = await callChain(systemPrompt, fullCtx, reasoningModels, 8192);
      planAndResponse = text;
      thinkingModelLabel = labelOf(AI_CATALOG[key].provider, AI_CATALOG[key].model);
      thoughtProcess.push({
        step: `Volta ${turn + 1}: Plano e Resposta (${thinkingModelLabel})`,
        description: 'Gerado com sucesso.',
        content: planAndResponse
      });
    } catch (e) {
      thoughtProcess.push({ step: `Volta ${turn + 1}: Erro`, description: e.message });
      currentResponse = `❌ Erro: ${e.message}`;
      finalConfidence = 'baixa';
      break;
    }

    let reviewResult = { ok: false, error: 'Falha na conferência' };
    try {
      const reviewPrompt = `Avalie a PERGUNTA e a RESPOSTA. Retorne SOMENTE JSON: {"ok": true|false, "erro": "..."}.\n\nPERGUNTA:\n${userMessage}\n\nRESPOSTA:\n${planAndResponse}\n`;
      const { text: reviewRaw, key: reviewUsedKey } = await callChain(null, [{ role: 'user', content: reviewPrompt }], [reviewModelKey], 1024);
      reviewResult = safeJSON(reviewRaw) || { ok: false, error: 'JSON inválido na revisão' };
      const reviewModelLabel = labelOf(AI_CATALOG[reviewUsedKey].provider, AI_CATALOG[reviewUsedKey].model);

      thoughtProcess.push({
        step: `Volta ${turn + 1}: Conferência (${reviewModelLabel})`,
        description: reviewResult.ok ? 'Conferido ✓' : `Corrigi um erro: ${reviewResult.error}`,
        result: reviewResult
      });
    } catch (e) {
      reviewResult = { ok: false, error: e.message };
    }

    if (reviewResult.ok) {
      currentResponse = planAndResponse;
      break;
    } else if (turn < MAX_TURNS - 1) {
      const correctionPrompt = `A resposta anterior foi:\n${planAndResponse}\n\nErro encontrado: "${reviewResult.error}". Corrija e forneça a resposta completa.`;
      fullCtx.push({ role: 'assistant', content: planAndResponse });
      fullCtx.push({ role: 'user', content: correctionPrompt });
      finalConfidence = 'baixa';
    } else {
      currentResponse = planAndResponse;
      finalConfidence = 'baixa';
    }
  }

  if (!currentResponse) {
    currentResponse = 'Não foi possível gerar a resposta.';
    finalConfidence = 'baixa';
  }

  return {
    reply: currentResponse,
    thoughtProcess,
    confidence: finalConfidence,
  };
}

module.exports = { pensar };
