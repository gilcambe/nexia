'use strict';

/**
 * Conta tokens em texto (aproximado).
 * @param {string} text
 * @returns {number}
 */
function countTokens(text) {
  if (!text) return 0;
  return text.split(/\s+/).filter(w => w.length).length;
}

module.exports = { countTokens };
