const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { comGroq, RESERVA } = require(path.join(__dirname, '../../lib/groq-modelo'));

test('lib/groq-modelo.js exporta RESERVA e comGroq', (t) => {
  // Valor da constante RESERVA deve ser uma string e não o modelo aposentado
  assert.strictEqual(typeof RESERVA, 'string');
  assert.notStrictEqual(RESERVA, 'llama-3.3-70b-versatile');

  // comGroq deve ser uma função
  assert.strictEqual(typeof comGroq, 'function');
});

test('comGroq retorna o resultado de fazer quando a chave está presente (caso comum)', (t) => {
  const resultado = comGroq('alguma-chave', () => 'valor-esperado');
  assert.strictEqual(resultado, 'valor-esperado');
});

test('comGroq devolve RESERVA quando a chave é falsy (caso de borda)', (t) => {
  const resultado = comGroq(null, () => 'não-deve-usar-isto');
  assert.strictEqual(resultado, RESERVA);
});

test('comGroq lança TypeError ao receber parâmetro fazer não‑funcional (entrada inválida)', (t) => {
  assert.throws(() => comGroq('chave', null), TypeError);
});