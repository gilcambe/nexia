// tests/unit/contrato-codigo-viagem.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { gerarCodigoViagem, validarCodigoViagem } = require('../../lib/codigo-viagem');

// alfabeto usado na implementação esperada (A‑Z sem I, L, O)
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // 23 caracteres

// helper para calcular o código esperado de forma determinística
function codigoEsperado(numero) {
  if (typeof numero !== 'number' || numero < 0 || !Number.isInteger(numero)) {
    throw new TypeError('numero deve ser inteiro não‑negativo');
  }
  const base = ALFABETO.length;
  let n = numero;
  let chars = [];
  do {
    const resto = n % base;
    chars.push(ALFABETO[resto]);
    n = Math.floor(n / base);
  } while (n > 0);
  // preenche até 6 caracteres com o primeiro símbolo (A)
  while (chars.length < 6) {
    chars.push(ALFABETO[0]);
  }
  return chars.reverse().join('');
}

test('caso comum: número 1 gera código esperado', (t) => {
  const esperado = codigoEsperado(1); // deve ser "AAAAAB"
  const resultado = gerarCodigoViagem(1);
  assert.equal(resultado, esperado);
  assert.ok(validarCodigoViagem(resultado)); // o código gerado deve ser válido
});

test('caso de borda: maior número que ainda cabe em 6 caracteres', (t) => {
  const maxNumero = Math.pow(ALFABETO.length, 6) - 1; // 23^6 - 1
  const esperado = codigoEsperado(maxNumero); // deve ser "ZZZZZZ"
  const resultado = gerarCodigoViagem(maxNumero);
  assert.equal(resultado, esperado);
  assert.ok(validarCodigoViagem(resultado));
});

test('entrada inválida: número negativo lança erro e código inválido falha na validação', (t) => {
  assert.throws(() => gerarCodigoViagem(-5), {
    name: 'TypeError'
  });
  // texto que não corresponde ao padrão (contém O e tem menos de 6 caracteres)
  const invalido = 'ABC0OZ';
  assert.equal(validarCodigoViagem(invalido), false);
});