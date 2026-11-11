'use strict';

/**
 * Converte um texto em slug para uso em URLs.
 * - Remove acentos e diacríticos.
 * - Converte para minúsculas.
 * - Substitui caracteres não alfanuméricos por hífens.
 * - Remove hífens duplicados e nas pontas.
 * - Limita a 40 caracteres, garantindo que não haja hífen no final.
 * @param {string} texto
 * @returns {string}
 */
function slug(texto) {
  if (typeof texto !== 'string') {
    return '';
  }

  // Normaliza e remove diacríticos (acentos)
  let s = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Converte para minúsculas e substitui caracteres não alfanuméricos por hífen
  s = s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  // Remove hífens das pontas
  s = s.replace(/^[-]+|[-]+$/g, '');

  // Limita a 40 caracteres
  if (s.length > 40) {
    s = s.slice(0, 40);
    // Caso o corte termine em hífen, remove-o
    s = s.replace(/[-]+$/g, '');
  }

  return s;
}

module.exports = { slug };
