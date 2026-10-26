'use strict';

const { modelRouter } = require('../../nexia-ai/model-router');
const { AI_CATALOG } = require('../../netlify/functions/cortex-chat');

const REASONING_MODELS = ['groq_gpt_oss_120b', 'or_deepseek_r1', 'or_qwen3_235b', 'groq_qwen'];
const REVIEW_MODEL = 'gemini_25_flash';

const MAX_TURNS = 2;
const TOTAL_TIMEOUT_MS = 40000;

function safeJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isMathOnly(userMessage) {
  const trimmed = userMessage.trim();
  return /^[\d\s\+\-\*\/\(\)\.,\%]+$/.test(trimmed) || /\b(quanto é|quanto faz|calcule|resolva)\b/i.test(trimmed);
}

async function calcular(expressao) {
  try {
    const resultado = eval(expressao.replace(/[^\d\.\+\-\*\/\(\)\, ]/g, ''));
    return { ok: true, resultado };
  } catch {
    return { ok: false, erro: 'não foi possível calcular' };
  }
}

async function avaliarComSeguranca(codigo) {
  const promises = [];
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout 2s')), 2000));
  const exec = new Promise((resolve, reject) => {
    try {
      const fn = new Function('return (' + codigo + ')');
      resolve({ ok: true, resultado: fn() });
    } catch (e) {
      reject(new Error('erro ao executar código'));\n    }
  });
  return Promise.race([exec, timeout]).then(r => r, e => ({ ok: false, erro: e.message }));
}

async function conferirResposta(userMessage, resposta) {
  let revisao = null;
  try {
    const promptReview = `Avalie a PERGUNTA e a RESPOSTA. Retorne SOMENTE JSON: {"ok": true|false, "erro": "..."}.
PERGUNTA:\n${userMessage}
\nRESPOSTA:\n${resposta}
`;
    const { text } = await modelRouter.getRouter().chat({ provider: 'gemini', model: 'gemini-2.5-flash' }, {
      system: null,
      messages: [{ role: 'user', content: promptReview }],
      maxTokens: 1024,
    });
    revisao = safeJSON(text) || { ok: false, erro: 'JSON inválido na revisão' };
  } catch {
    revisao = { ok: false, erro: 'falha ao conferir' };
  }

  if (isMathOnly(userMessage)) {
    const calculo = await calcular(resposta.match(/[\d\.\+\-\*\/\(\)]+/) || '0');
    if (!calculo.ok) revisao.ok = false;
  }

  return revisao;
}

async function pensar(systemPrompt, messages, userMessage) {
  const startTime = Date.now();
  const thoughtProcess = [];
  let currentResponse = '';
  let confidence = 'alta';
  let corrigidoPasso = null;

  const reasoningKeys = [];
  for (const k of REASONING_MODELS) {
    if (AI_CATALOG[k]) reasoningKeys.push(k);
  }

  if (reasoningKeys.length === 0) {
    return {
      reply: '❌ Modelos de raciocínio indisponíveis.',
      thoughtProcess: [{ step: 'Erro', description: 'Nenhum modelo de raciocínio configurado.' }],
      confidence: 'baixa',
    };
  }

  const fullCtx = [...messages, { role: 'user', content: userMessage }];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    if (Date.now() - startTime >= TOTAL_TIMEOUT_MS) {
      thoughtProcess.push({ step: `Volta ${turn + 1}: Timeout`, description: 'Prazo limite atingido.' });
      confidence = 'baixa';
      break;
    }

    let planAndResponse = '';
    let thinkingModelLabel = '';
    try {
      const key = reasoningKeys[turn % reasoningKeys.length];
      const ai = AI_CATALOG[key];
      planAndResponse = await modelRouter.getRouter().chat({ provider: ai.provider, model: ai.model }, {
        system: systemPrompt,
        messages: fullCtx,
        maxTokens: 8192,
      });
      thinkingModelLabel = ai.label || ai.model;
      thoughtProcess.push({
        step: `Volta ${turn + 1}: Plano e Resposta (${thinkingModelLabel})`,
        description: 'Gerado com sucesso.',
        content: planAndResponse,
      });
    } catch (e) {
      thoughtProcess.push({ step: `Volta ${turn + 1}: Erro`, description: e.message });
      currentResponse = `❌ Erro: ${e.message}`;
      confidence = 'baixa';
      break;
    }

    let reviewResult = { ok: false, erro: 'Falha na conferência' };
    try {
      reviewResult = await conferirResposta(userMessage, planAndResponse);
      const reviewModelLabel = AI_CATALOG[REVIEW_MODEL]?.label || REVIEW_MODEL;
      thoughtProcess.push({
        step: `Volta ${turn + 1}: Conferência (${reviewModelLabel})`,
        description: reviewResult.ok ? 'Conferido ✓' : `Erro: ${reviewResult.erro}`,
        result: reviewResult,
      });
    } catch (e) {
      reviewResult = { ok: false, erro: e.message };
    }

    if (reviewResult.ok) {
      currentResponse = planAndResponse;
      break;
    } else if (turn < MAX_TURNS - 1) {
      corrigidoPasso = `passo ${turn + 1}`;
      confidence = 'baixa';
      const correctionPrompt = `A resposta anterior foi:\n${planAndResponse}\n\nErro encontrado: "${reviewResult.erro}". Corrija e forneça a resposta completa.`;
      fullCtx.push({ role: 'assistant', content: planAndResponse });
      fullCtx.push({ role: 'user', content: correctionPrompt });
    } else {
      currentResponse = planAndResponse;
      confidence = 'baixa';
    }
  }

  if (!currentResponse) {
    currentResponse = 'Não foi possível gerar a resposta.';
    confidence = 'baixa';
  }

  const textoCerteza = confidence === 'baixa' ? '\n\nCerteza: baixa' : '';
  const textoComoPensei = thoughtProcess.map(t => `
### ${t.step}
${t.description}${t.content ? '\n' + t.content : ''}${t.result ? '\nConferência: ' + (t.result.ok ? 'ok' : 'erro: ' + t.result.erro) : ''}`).join('');

  return {
    reply: currentResponse + textoCerteza,
    thoughtProcess,
    confidence,
    comoPensei: textoComoPensei,
    corrigidoPasso,
  };
}

module.exports = { pensar };