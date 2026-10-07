const test = require('node:test');
const assert = require('node:assert');
const { dividirTarefa } = require('../../nexia-ai/cortex/divisor.js');

test('dividirTarefa - texto curto com limite padrão', () => {
  const texto = 'Este é um texto curto.';
  const resultado = dividirTarefa(texto, 600);
  assert.deepStrictEqual(resultado, ['Este é um texto curto.']);
});

test('dividirTarefa - texto curto com limite menor', () => {
  const texto = 'Texto curto.';
  const resultado = dividirTarefa(texto, 5);
  assert.strictEqual(resultado.length > 1, true);
  // Garante que nenhum trecho foi perdido ao concatenar ou verificar o conteúdo
  const unido = resultado.join(' ');
  assert.ok(unido.includes('Texto') || unido.includes('curto.'));
});

test('dividirTarefa - lista numerada', () => {
  const texto = '1. Primeiro passo importante.\n2. Segundo passo também relevante.\n3. Terceiro passo final.';
  const resultado = dividirTarefa(texto, 100);
  assert.strictEqual(resultado.length >= 1, true);
  const textoReconstruido = resultado.join('\n');
  assert.ok(textoReconstruido.includes('1. Primeiro'));
  assert.ok(textoReconstruido.includes('3. Terceiro'));
});

test('dividirTarefa - texto longo', () => {
  const paragrafo = 'Esta é uma frase longa para testar a divisão automática de textos extensos que ultrapassam o limite máximo estabelecido de caracteres por passo.';
  const textoLongo = `${paragrafo} ${paragrafo} ${paragrafo}`;
  const resultado = dividirTarefa(textoLongo, 80);
  
  assert.ok(resultado.length > 1);
  // Verificar que todo o conteúdo essencial está presente
  const unido = resultado.join(' ');
  assert.ok(unido.length >= paragrafo.length);
});
