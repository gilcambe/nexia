'use strict';

/**
 * Remove any non‑digit characters from the input.
 * @param {string} str
 * @returns {string}
 */
function onlyDigits(str) {
  return (str || '').replace(/\D+/g, '');
}

/**
 * Checks whether all characters in a string are the same.
 * @param {string} str
 * @returns {boolean}
 */
function allDigitsEqual(str) {
  return /^(\d)\1*$/.test(str);
}

/**
 * Calculates a verification digit for CNPJ.
 * @param {string[]} digits Array of numeric strings.
 * @param {number[]} weights Weight sequence.
 * @returns {number}
 */
function calcVerifier(digits, weights) {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += Number(digits[i]) * weights[i];
  }
  const mod = sum % 11;
  return mod < 2 ? 0 : 11 - mod;
}

/**
 * Validates a CNPJ (with or without mask).
 * @param {string} cnpj
 * @returns {boolean}
 */
function valido(cnpj) {
  const num = onlyDigits(cnpj);
  if (num.length !== 14) return false;
  if (allDigitsEqual(num)) return false;

  const base = num.slice(0, 12).split('');
  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const firstVer = calcVerifier(base, firstWeights);
  if (firstVer !== Number(num[12])) return false;

  const secondBase = num.slice(0, 13).split('');
  const secondWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const secondVer = calcVerifier(secondBase, secondWeights);
  if (secondVer !== Number(num[13])) return false;

  return true;
}

/**
 * Formats a valid CNPJ with mask "00.000.000/0000-00".
 * Returns null if the CNPJ is invalid.
 * @param {string} cnpj
 * @returns {string|null}
 */
function formatar(cnpj) {
  if (!valido(cnpj)) return null;
  const num = onlyDigits(cnpj);
  return (
    num.slice(0, 2) + '.' +
    num.slice(2, 5) + '.' +
    num.slice(5, 8) + '/' +
    num.slice(8, 12) + '-' +
    num.slice(12)
  );
}

module.exports = {
  valido,
  formatar,
};
