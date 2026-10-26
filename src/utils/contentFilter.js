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

export default { hasContentViolation };
