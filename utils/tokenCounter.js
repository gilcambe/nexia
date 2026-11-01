'use strict';

/**
 * Conta tokens em texto (aproximado).
 * @param {string} text
 * @returns {number}
 */
function countTokens(text) {
  if (!text) return 0;
  // Aproximação simples: cada palavra conta como 1 token.
  return text.split(/\s+/).filter(w => w.length).length;
}

module.exports = { countTokens };
