'use strict';

/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  NEXIA OS — CORTEX TOKENS v1.0                                       ║
 * ║  Estimativa de tokens de entrada e otimização de histórico.        ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

const { listFor } = require('../nexia-ai/orchestrator/models');
const modelRouter = require('../nexia-ai/model-router');

/**
 * Estima a quantidade de tokens de entrada para um texto ou array de mensagens.
 * Utiliza proporção conservadora de ~3.5 caracteres por token.
 *
 * @param {string|Array} input
 * @returns {number}
 */
function estimarTokens(input) {
  if (!input) return 0;
  if (typeof input === 'string') {
    return Math.ceil(input.length / 3.5);
  }
  if (Array.isArray(input)) {
    let totalChars = 0;
    for (const msg of input) {
      if (!msg) continue;
      if (typeof msg === 'string') {
        totalChars += msg.length;
      } else if (msg.content) {
        totalChars += (msg.role || '').length + String(msg.content).length;
      }
    }
    return Math.ceil(totalChars / 3.5);
  }
  return 0;
}

/**
 * Otimiza o histórico de mensagens se o total de tokens exceder o orçamento.
 * Mantém as 4 últimas mensagens inteiras. Submete as anteriores para resumo curto (máx 150 tokens).
 * Possui fallback seguro em caso de falha da IA rápida.
 *
 * @param {Array} history Array de mensagens no formato [{ role, content }]
 * @param {Object} options
 * @param {number} [options.budgetTokens=4000] Orçamento máximo de tokens de entrada
 * @param {number} [options.keepRecent=4] Quantidade de mensagens recentes mantidas na íntegra
 * @returns {Promise<{ messages: Array, tokensBefore: number, tokensAfter: number, summarized: boolean }>}
 */
async function otimizarHistorico(history = [], options = {}) {
  const keepRecent = options.keepRecent || 4;
  const budgetTokens = options.budgetTokens || 4000;

  const tokensBefore = estimarTokens(history);

  // Se o histórico está dentro do orçamento ou não possui mensagens suficientes para dividir
  if (tokensBefore <= budgetTokens || history.length <= keepRecent) {
    return {
      messages: history,
      tokensBefore,
      tokensAfter: tokensBefore,
      summarized: false
    };
  }

  // Divisão: mensagens antigas e 4 últimas inteiras
  const oldMessages = history.slice(0, history.length - keepRecent);
  const recentMessages = history.slice(history.length - keepRecent);

  let summaryContent = null;

  // Tentativa de sumarização com modelos da classe 'fast'
  try {
    const fastCandidates = listFor('fast').filter(d => d.provider !== 'anthropic');
    const textToSummarize = oldMessages
      .map(m => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`)
      .join('\n');

    const prompt = `Resuma o histórico de conversa anterior em no máximo 150 tokens. Preserve fatos principais, decisões e contexto essenciais:\n\n${textToSummarize}`;

    for (const candidate of fastCandidates) {
      try {
        const res = await modelRouter.getRouter().chat(
          { provider: candidate.provider, model: candidate.model },
          {
            system: 'Você é um assistente conciso de sumarização de memória.',
            messages: [{ role: 'user', content: prompt }],
            maxTokens: 150
          }
        );
        if (res && res.text && res.text.trim()) {
          summaryContent = res.text.trim();
          break;
        }
      } catch (e) {
        // Tenta o próximo candidato
      }
    }
  } catch (e) {
    // Erro geral na tentativa de usar a IA rápida
  }

  // Fallback se a sumarização falhar: cria um resumo sintético curto dos tópicos antigos sem quebrar
  if (!summaryContent) {
    const fallbackText = oldMessages
      .filter(m => m.content)
      .map(m => String(m.content).slice(0, 80))
      .join(' | ')
      .slice(0, 300);
    summaryContent = `[Resumo sintético do histórico anterior]: ${fallbackText}...`;
  }

  const optimizedMessages = [
    { role: 'system', content: `[Resumo do histórico anterior]: ${summaryContent}` },
    ...recentMessages
  ];

  const tokensAfter = estimarTokens(optimizedMessages);

  return {
    messages: optimizedMessages,
    tokensBefore,
    tokensAfter,
    summarized: true
  };
}

module.exports = {
  estimarTokens,
  otimizarHistorico
};
