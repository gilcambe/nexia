'use strict';

/**
 * Resume um histórico de mensagens mantendo as mais recentes e as mais relevantes.
 * @param {Array} messages - Histórico de mensagens
 * @param {number} maxTokens - Limite máximo de tokens
 * @param {Function} tokenCounter - Função para contar tokens
 * @returns {Array} Histórico resumido
 */
function summarizeHistory(messages, maxTokens, tokenCounter) {
  if (!messages || !messages.length) return [];

  const relevantMessages = messages.filter(m => m.role === 'user' || (m.role === 'assistant' && m.content && m.content.includes('ferramenta')));
  const recentMessages = messages.slice(-10);

  const combined = [...new Set([...relevantMessages, ...recentMessages])].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  let totalTokens = 0;
  const summarized = [];

  for (const msg of combined) {
    const msgTokens = tokenCounter(msg.content || '');
    if (totalTokens + msgTokens > maxTokens) break;
    summarized.unshift(msg);
    totalTokens += msgTokens;
  }

  return summarized;
}

module.exports = { summarizeHistory };
