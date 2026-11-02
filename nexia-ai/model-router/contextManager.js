'use strict';

const { countTokens } = require('../../utils/tokenCounter');
const { summarizeHistory } = require('../../utils/summary');

/**
 * Gerencia o contexto das mensagens antes de chamadas ao modelo.
 * Usa tokenCounter para medir o tamanho do prompt e summary para cortar
 * partes menos prováveis quando excede o limite de tokens configurado.
 * @param {Object} options
 * @param {number} options.maxTokens - Limite máximo de tokens (padrão 4096)
 * @returns {Object} - Objeto com métodos para gerenciar contexto
 */
function createContextManager(options = {}) {
  const maxTokens = options.maxTokens || 4096;

  /**
   * Processa o histórico de mensagens antes de enviar ao modelo.
   * Conta os tokens do prompt e, se exceder o limite, resume o histórico.
   * @param {Array} messages - Histórico de mensagens
   * @returns {Array} - Histórico processado dentro do limite de tokens
   */
  function processHistory(messages) {
    if (!messages || !messages.length) return [];

    // Conta os tokens do histórico atual
    let totalTokens = messages.reduce((sum, msg) => sum + countTokens(msg.content || ''), 0);

    // Se estiver dentro do limite, retorna o histórico original
    if (totalTokens <= maxTokens) return messages;

    // Se exceder, resume o histórico mantendo as mensagens mais recentes/relevantes
    return summarizeHistory(messages, maxTokens, countTokens);
  }

  /**
   * Retorna o número de tokens de um texto.
   * @param {string} text
   * @returns {number}
   */
  function countTokensOf(text) {
    return countTokens(text || '');
  }

  return {
    processHistory,
    countTokensOf,
    maxTokens
  };
}

module.exports = { createContextManager };