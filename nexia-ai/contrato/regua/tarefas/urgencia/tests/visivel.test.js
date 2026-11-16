const { test } = require('node:test'); const assert = require('node:assert');
const { urgencia } = require('../src/urgencia');
test('exemplos', () => {
  assert.strictEqual(urgencia('Tem fogo na garagem'), 'alta');
  assert.strictEqual(urgencia('Cheiro forte de gás no 3º andar'), 'alta');
  assert.strictEqual(urgencia('A lâmpada do corredor queimou'), 'normal');
  assert.strictEqual(urgencia('Pintura descascando no hall'), 'normal');
});
