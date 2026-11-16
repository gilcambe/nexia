const { test } = require('node:test'); const assert = require('node:assert');
const { lerConfig } = require('../src/config');
test('lê segredo e porta', () => {
  const c = lerConfig({ SEGREDO: 'a'.repeat(40), PORTA: '8080' });
  assert.strictEqual(c.segredo, 'a'.repeat(40)); assert.strictEqual(c.porta, 8080);
});
