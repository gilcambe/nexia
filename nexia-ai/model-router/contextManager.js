'use strict';

const { countTokens } = require('../../utils/tokenCounter');
const { summarizeHistory } = require('../../utils/summary');

/**
 * Gerencia o contexto das mensagens antes de chamadas ao modelo.
 * @param {Object} options
 * @param {number} options.maxTokens - Limite máximo de tokens
 * @returns {Object} - Objeto com métodos para gerenciar contexto
 */
function createContextManager(options = {}) {
  const maxTokens = options.maxTokens || 4096;

  /**
   * Processa o histórico de mensagens antes de enviar ao modelo.
   * @param {Array} messages - Histórico de mensagens
   * @returns {Array} - Histórico processado
   */
  function processHistory(messages) {
    if (!messages || !messages.length) return [];

    // Primeiro, conta os tokens do histórico atual
    let totalTokens = messages.reduce((sum, msg) => sum + countTokens(msg.content), 0);

    // Se estiver dentro do limite, retorna o histórico original
    if (totalTokens <= maxTokens) return messages;

    // Se exceder, resume o histórico
    return summarizeHistory(messages, maxTokens, countTokens);
  }

  return {
    processHistory,
    maxTokens
  };
}

module.exports = { createContextManager };
