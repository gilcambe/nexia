// tests/unit/contrato-codigo-viagem.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

// Importa as funções que deverão ser implementadas em lib/codigo-viagem.js
const { encodeReservationNumber, isValidCodigoViagem } = require(path.join(__dirname, "../../lib/codigo-viagem.js"));

// Expressão regular que aceita apenas letras maiúsculas excluindo O, I, L
const CODIGO_REGEX = /^[A-HJ-KM-NP-Z]{6}$/;

test("encodeReservationNumber gera código válido, determinístico e de 6 caracteres", t => {
  const num = 12345;
  const code1 = encodeReservationNumber(num);
  const code2 = encodeReservationNumber(num);

  // Deve ter exatamente 6 caracteres
  assert.strictEqual(code1.length, 6, "O código deve ter 6 caracteres");
  // Apenas letras permitidas
  assert.match(code1, CODIGO_REGEX, "O código deve conter apenas letras permitidas");
  // Determinismo: chamadas repetidas retornam o mesmo valor
  assert.strictEqual(code1, code2, "A função deve ser determinística");
});

test("encodeReservationNumber aceita o menor número positivo (1) e gera código válido", t => {
  const code = encodeReservationNumber(1);
  assert.strictEqual(code.length, 6, "Código deve ter 6 caracteres");
  assert.match(code, CODIGO_REGEX, "Código deve conter apenas letras permitidas");
});

test("encodeReservationNumber lança erro para entrada inválida (número negativo, não inteiro ou não numérico)", t => {
  assert.throws(() => encodeReservationNumber(-5), {
    name: "TypeError"
  }, "Número negativo deve causar TypeError");

  assert.throws(() => encodeReservationNumber(3.14), {
    name: "TypeError"
  }, "Número não inteiro deve causar TypeError");

  assert.throws(() => encodeReservationNumber("abc"), {
    name: "TypeError"
  }, "Valor não numérico deve causar TypeError");
});

test("isValidCodigoViagem reconhece código gerado como válido", t => {
  const validCode = encodeReservationNumber(98765);
  assert.ok(isValidCodigoViagem(validCode), "Código gerado deve ser reconhecido como válido");
});

test("isValidCodigoViagem rejeita formatos inválidos", t => {
  // Caracter proibido (0)
  assert.strictEqual(isValidCodigoViagem("ABC0DE"), false, "Código contendo '0' deve ser inválido");
  // Comprimento incorreto
  assert.strictEqual(isValidCodigoViagem("ABCD"), false, "Código com menos de 6 caracteres deve ser inválido");
  // Caracter não alfabético
  assert.strictEqual(isValidCodigoViagem("AB2DEF"), false, "Código contendo dígitos deve ser inválido");
});