// lib/codigo-viagem.js

// Alfabeto permitido: A‑Z sem I, L, O (23 caracteres)
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const BASE = ALFABETO.length;

/**
 * Converte um número inteiro não‑negativo em um código de 6 letras
 * usando o alfabeto acima. Lança TypeError para valores inválidos.
 *
 * @param {number} numero - inteiro não‑negativo
 * @returns {string} código de 6 letras maiúsculas
 */
function gerarCodigoViagem(numero) {
  if (typeof numero !== 'number' || !Number.isInteger(numero) || numero < 0) {
    throw new TypeError('numero deve ser inteiro não‑negativo');
  }

  let n = numero;
  const chars = [];

  // Conversão para base 23 usando o alfabeto
  do {
    const resto = n % BASE;
    chars.push(ALFABETO[resto]);
    n = Math.floor(n / BASE);
  } while (n > 0);

  // Preenchimento até 6 caracteres com o primeiro símbolo (A)
  while (chars.length < 6) {
    chars.push(ALFABETO[0]);
  }

  return chars.reverse().join('');
}

/**
 * Valida se o texto corresponde ao formato esperado de código de viagem:
 * exatamente 6 letras maiúsculas do alfabeto permitido.
 *
 * @param {string} texto
 * @returns {boolean}
 */
function validarCodigoViagem(texto) {
  if (typeof texto !== 'string') return false;
  const regex = new RegExp(`^[${ALFABETO}]{6}$`);
  return regex.test(texto);
}

module.exports = {
  gerarCodigoViagem,
  validarCodigoViagem,
};
