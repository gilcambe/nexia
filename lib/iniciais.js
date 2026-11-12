'use strict';

/**
 * Retorna as iniciais em maiúsculas das duas primeiras palavras de um nome,
 * ignorando palavras de conexão (da, de, do, das, dos, e) que não sejam a primeira.
 *
 * @param {string} nome - O nome completo.
 * @returns {string} As iniciais ou string vazia.
 */
function iniciais(nome) {
  if (!nome) return '';
  // Normaliza espaços
  const palavras = nome
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ');
  if (palavras.length === 0) return '';

  const ignorar = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

  // Remove palavras ignoradas (exceto a primeira)
  const filtrado = palavras.filter((p, i) => i === 0 || !ignorar.has(p.toLowerCase()));

  // Pega até duas palavras
  const selecionadas = filtrado.slice(0, 2);

  // Constrói as iniciais
  const inic = selecionadas
    .map(p => p[0].toUpperCase())
    .join('');

  return inic;
}

module.exports = { iniciais };
