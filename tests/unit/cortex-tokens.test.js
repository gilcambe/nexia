import { test, assert } from 'node:test';
import { contarTokens } from '../lib/cortex-tokens.js';

function erroPercentual(resultado, referencia) {
  return Math.abs(resultado - referencia) / referencia * 100;
}

test('contarTokens portugues curto - erro abaixo de 20%', () => {
  const texto = 'O gato está no telhado e miando alto.';
  const referencia = texto.length / 3.6;
  const resultado = contarTokens(texto);
  assert.ok(erroPercentual(resultado, referencia) < 20, `erro ${erroPercentual(resultado, referencia).toFixed(2)}%`);
});

test('contarTokens portugues medio - erro abaixo de 20%', () => {
  const texto = 'Aprender a programar exige prática diária e paciência para entender os conceitos básicos.';
  const referencia = texto.length / 3.6;
  const resultado = contarTokens(texto);
  assert.ok(erroPercentual(resultado, referencia) < 20, `erro ${erroPercentual(resultado, referencia).toFixed(2)}%`);
});

test('contarTokens portugues longo - erro abaixo de 20%', () => {
  const texto = 'A inteligência artificial está transformando diversos setores da economia com automação e análise de dados em grande escala.';
  const referencia = texto.length / 3.6;
  const resultado = contarTokens(texto);
  assert.ok(erroPercentual(resultado, referencia) < 20, `erro ${erroPercentual(resultado, referencia).toFixed(2)}%`);
});

test('contarTokens codigo curto - erro abaixo de 20%', () => {
  const texto = 'const resultado = soma(a, b) * 2;';
  const referencia = texto.length / 3;
  const resultado = contarTokens(texto);
  assert.ok(erroPercentual(resultado, referencia) < 20, `erro ${erroPercentual(resultado, referencia).toFixed(2)}%`);
});

test('contarTokens codigo longo - erro abaixo de 20%', () => {
  const texto = 'function calcularMedia(numeros) { let total = 0; for (let n of numeros) { total += n; } return total / numeros.length; }';
  const referencia = texto.length / 3;
  const resultado = contarTokens(texto);
  assert.ok(erroPercentual(resultado, referencia) < 20, `erro ${erroPercentual(resultado, referencia).toFixed(2)}%`);
});

test('contarTokens texto vazio ou invalido retorna 0', () => {
  assert.strictEqual(contarTokens(''), 0);
  assert.strictEqual(contarTokens(null), 0);
  assert.strictEqual(contarTokens(undefined), 0);
  assert.strictEqual(contarTokens(123), 0);
});
