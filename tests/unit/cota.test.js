'use strict';
const { strict: assert } = require('assert');
const { getPlacar } = require('../../nexia-ai/model-router/cota');

const groq = { provider: 'groq', model: 'openai/gpt-oss-120b' };
const kilo = { provider: 'kilo', model: 'auto:1' };

test('getPlacar.marca daily e ordenar tira da lista; quando vence, volta', () => {
  const placar = getPlacar();
  const lista = [groq, kilo];

  assert.deepStrictEqual(placar.ordenar(lista), [groq, kilo]);

  placar.marcar(groq, 'daily', 200);
  assert.deepStrictEqual(placar.ordenar(lista), [kilo]);

  return new Promise(resolve => setTimeout(resolve, 250)).then(() => {
    assert.deepStrictEqual(placar.ordenar(lista), [kilo, groq]);
  });
});
