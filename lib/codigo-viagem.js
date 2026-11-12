// lib/codigo-viagem.js

// Alfabeto permitido: todas as letras maiúsculas exceto O, I, L
const ALPHABET = [
  'A','B','C','D','E','F','G','H',
  'J','K',
  'M','N',
  'P','Q','R','S','T','U','V','W','X','Y','Z'
];
const BASE = ALPHABET.length; // 23
const CODE_LENGTH = 6;

/**
 * Converte um número de reserva positivo em um código de 6 letras.
 *
 * @param {number} reservationNumber - Número inteiro positivo.
 * @returns {string} Código de 6 letras maiúsculas.
 * @throws {TypeError} Se o argumento não for um inteiro positivo.
 */
function encodeReservationNumber(reservationNumber) {
  if (typeof reservationNumber !== 'number' ||
      !Number.isInteger(reservationNumber) ||
      reservationNumber <= 0) {
    throw new TypeError('reservationNumber must be a positive integer');
  }

  // Conversão para base 23 usando o alfabeto permitido
  let num = reservationNumber;
  let chars = [];

  while (num > 0) {
    const remainder = (num - 1) % BASE; // -1 para tornar 1 → A, 2 → B, ...
    chars.unshift(ALPHABET[remainder]);
    num = Math.floor((num - 1) / BASE);
  }

  // Preenche com 'A' à esquerda para garantir comprimento fixo
  while (chars.length < CODE_LENGTH) {
    chars.unshift(ALPHABET[0]); // 'A'
  }

  // Se exceder o tamanho, mantemos os últimos CODE_LENGTH caracteres
  if (chars.length > CODE_LENGTH) {
    chars = chars.slice(-CODE_LENGTH);
  }

  return chars.join('');
}

/**
 * Verifica se o texto corresponde ao formato de código de viagem.
 *
 * @param {string} code - Texto a ser verificado.
 * @returns {boolean} true se for um código válido, false caso contrário.
 */
function isValidCodigoViagem(code) {
  const CODIGO_REGEX = /^[A-HJ-KM-NP-Z]{6}$/;
  return typeof code === 'string' && CODIGO_REGEX.test(code);
}

module.exports = {
  encodeReservationNumber,
  isValidCodigoViagem
};
