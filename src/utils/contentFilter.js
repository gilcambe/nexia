import { prohibitedWords } from '../config/prohibitedWords.js';

/**
 * Verifica se um texto contém algum termo proibido.
 * @param {string} text - O texto a ser verificado.
 * @returns {boolean} - Retorna true se houver violação (contiver termo proibido), false caso contrário.
 */
export function hasContentViolation(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }
  const lowerText = text.toLowerCase();
  return prohibitedWords.some(word => lowerText.includes(word.toLowerCase()));
}

/**
 * Filtra a resposta gerada pela IA, substituindo por mensagem de recusa caso contenha termos proibidos.
 * @param {string} responseText - O texto da resposta gerada pela IA.
 * @returns {string} - A resposta original ou a mensagem de recusa educada.
 */
export function filterAIResponse(responseText) {
  if (hasContentViolation(responseText)) {
    return "Desculpe, não posso ajudar com isso.";
  }
  return responseText;
}

export default { hasContentViolation, filterAIResponse };
