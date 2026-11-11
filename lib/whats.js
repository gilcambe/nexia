'use strict';

/**
 * Normaliza um número de telefone para o formato internacional brasileiro
 * esperado pelo wa.me: "55" + DDD + número (apenas dígitos).
 *
 * @param {string|null|undefined} texto - Texto contendo o número.
 * @returns {string|null} Número normalizado ou null se inválido.
 */
function normalizar(texto) {
  if (texto == null) return null;

  // Remove tudo que não seja dígito.
  const digits = String(texto).replace(/\D/g, '');

  if (!digits) return null;

  // Caso já contenha o código do país.
  if (digits.startsWith('55')) {
    const rest = digits.slice(2);
    if (rest.length === 10 || rest.length === 11) {
      return digits;
    }
  }

  // Caso não contenha o código do país, aceita DDD + número (10 ou 11 dígitos).
  if (digits.length === 10 || digits.length === 11) {
    return '55' + digits;
  }

  return null;
}

/**
 * Gera o link wa.me a partir de um número de telefone e mensagem opcional.
 *
 * @param {string|null|undefined} texto - Texto contendo o número.
 * @param {string} [mensagem] - Mensagem a ser incluída no link.
 * @returns {string|null} URL completa ou null se o número for inválido.
 */
function link(texto, mensagem) {
  const numero = normalizar(texto);
  if (!numero) return null;

  let url = `https://wa.me/${numero}`;

  if (mensagem != null && mensagem !== '') {
    url += `?text=${encodeURIComponent(mensagem)}`;
  }

  return url;
}

module.exports = { normalizar, link };
