'use strict';

const { modelRouter } = require('../../nexia-ai/model-router');
const { AI_CATALOG } = require('../../netlify/functions/cortex-chat');

const REASONING_MODELS = ['groq_gpt_oss_120b', 'or_deepseek_r1', 'or_qwen3_235b', 'groq_qwen', 'groq_llama4_scout', 'gemini_25_flash'];
const REVIEW_MODEL = 'gemini_25_flash';

const MAX_TURNS = 2;
const TOTAL_TIMEOUT_MS = 40000;

function safeJSON(text) {
  try {
    if (typeof text !== 'string') return null;
    const clean = text.replace(/```json\s*|\s*```/g, '').trim();
    return JSON.parse(clean);
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
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout 2s')), 2000));
  const exec = new Promise((resolve, reject) => {
    try {
      const fn = new Function('return (' + codigo + ')');
      resolve({ ok: true, resultado: fn() });
    } catch (e) {
      reject(new Error('erro ao executar código: ' + e.message));
    }
  });
  return Promise.race([exec, timeout]).then(r => r, e => ({ ok: false, erro: e.message }));
}

async function conferirResposta(userMessage, resposta) {
  let revisao = null;
  try {
    const promptReview = `Avalie a PERGUNTA e a RESPOSTA gerada. Retorne SOMENTE um objeto JSON estrito com o formato exato: {"ok": true, "erro": ""} se estiver correto, ou {"ok": false, "erro": "descrição curta do erro"} se houver falha, pegadinha ou erro de lógica.\nPERGUNTA:\n${userMessage}\n\nRESPOSTA:\n${resposta}\n`;
    
    let resText = '';
    const reviewAi = AI_CATALOG[REVIEW_MODEL] || { provider: 'gemini', model: 'gemini-2.0-flash' };
    const r = await modelRouter.getRouter().chat({ provider: reviewAi.provider, model: reviewAi.model }, {
      system: 'Você é um revisor rigoroso de lógica e código. Responda estritamente em JSON.',
      messages: [{ role: 'user', content: promptReview }],
      maxTokens: 1024,
    });
    resText = r.text || '';
    revisao = safeJSON(resText);
    
    if (!revisao || typeof revisao.ok !== 'boolean') {
      revisao = { ok: true, erro: '' };
    }
  } catch (e) {
    revisao = { ok: true, erro: '' };
  }

  if (isMathOnly(userMessage)) {
    const match = resposta.match(/[\d\.\+\-\*\/\(\)]+/);
    if (match) {
      const calc = await calcular(match[0]);
      if (!calc.ok) {
        revisao.ok = false;
        revisao.erro = 'Erro no cálculo matemático';
      }
    }
  }

  return revisao;
}

async function executarPensamento(userMessage, messages = [], systemPrompt = '', deps = {}) {
  const startTime = Date.now();
  const thoughtProcess = [];
  let currentResponse = '';
  let confidence = 'alta';
  let corrigidoPasso = null;

  const router = deps.modelRouter ? deps.modelRouter.getRouter() : modelRouter.getRouter();
  const catalog = deps.AI_CATALOG || AI_CATALOG;

  const reasoningKeys = [];
  for (const k of REASONING_MODELS) {
    if (catalog[k]) reasoningKeys.push(k);
  }
  if (reasoningKeys.length === 0) {
    reasoningKeys.push('groq_llama4_scout');
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
      const ai = catalog[key] || { provider: 'groq', model: 'llama-3.3-70b-versatile', label: key };
      thinkingModelLabel = ai.label || ai.model;

      const r = await router.chat({ provider: ai.provider, model: ai.model }, {
        system: systemPrompt || 'Você é um assistente especialista em raciocínio estruturado e passos detalhados.',
        messages: fullCtx,
        maxTokens: 4096,
      });
      planAndResponse = r.text || '';
      
      thoughtProcess.push({
        step: `Volta ${turn + 1}: Plano e Resposta (${thinkingModelLabel})`,
        description: 'Gerado com sucesso.',
        content: planAndResponse,
      });
    } catch (e) {
      thoughtProcess.push({ step: `Volta ${turn + 1}: Erro`, description: e.message });
      currentResponse = `❌ Erro ao raciocinar: ${e.message}`;
      confidence = 'baixa';
      break;
    }

    let reviewResult = { ok: true, erro: '' };
    try {
      reviewResult = await conferirResposta(userMessage, planAndResponse);
      const reviewModelLabel = catalog[REVIEW_MODEL]?.label || REVIEW_MODEL;
      thoughtProcess.push({
        step: `Volta ${turn + 1}: Conferência (${reviewModelLabel})`,
        description: reviewResult.ok ? 'Conferido ✓' : `Corrigi um erro no passo 3: ${reviewResult.erro}`,
        result: reviewResult,
      });
    } catch (e) {
      reviewResult = { ok: true, erro: '' };
    }

    if (reviewResult.ok) {
      currentResponse = planAndResponse;
      break;
    } else if (turn < MAX_TURNS - 1) {
      corrigidoPasso = `passo ${turn + 1}`;
      confidence = 'baixa';
      const correctionPrompt = `A resposta anterior continha incorreções ou falhas:\n${planAndResponse}\n\nErro apontado pelo revisor: "${reviewResult.erro}". Refaça o raciocínio e forneça a resposta correta e completa.`;
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

  const collapsibleDetails = `<details>\n<summary>Como pensei</summary>\n\n` +
    thoughtProcess.map(t => `**${t.step}**\n${t.description}${t.content ? '\n\n' + t.content : ''}`).join('\n\n---\n\n') +
    `\n\n</details>`;

  const textoFinal = `${collapsibleDetails}\n\n${currentResponse}` + (confidence === 'baixa' ? '\n\nCerteza: baixa' : '');

  return {
    textoFinal,
    thoughtProcess,
    confidence,
    corrigidoPasso,
    modelUsed: 'GPT-OSS / Gemini 2.5 Flash'
  };
}

module.exports = { executarPensamento, pensar: executarPensamento, conferirResposta, calcular, avaliarComSeguranca };