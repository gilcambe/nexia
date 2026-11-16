const { test } = require('node:test'); const assert = require('node:assert');
const { lerConfig } = require('../src/config');
test('porta padrão 3000', () => { assert.strictEqual(lerConfig({ SEGREDO: 'b'.repeat(32) }).porta, 3000); });
test('sem segredo e sem demo: SEGREDO_FRACO', () => {
  for (const env of [{}, { SEGREDO: 'curto' }, { DEMO: 'false' }]) assert.throws(() => lerConfig(env), e => e.code === 'SEGREDO_FRACO', JSON.stringify(env));
});
test('demo sem segredo funciona com segredo de 32+', () => { const c = lerConfig({ DEMO: 'true' }); assert.ok(typeof c.segredo === 'string' && c.segredo.length >= 32); });
test('segredo do ambiente vence o de demo', () => { assert.strictEqual(lerConfig({ DEMO: 'true', SEGREDO: 'c'.repeat(33) }).segredo, 'c'.repeat(33)); });
test('não lê process.env por conta própria', () => {
  process.env.SEGREDO = 'd'.repeat(40);
  try { assert.throws(() => lerConfig({}), e => e.code === 'SEGREDO_FRACO'); } finally { delete process.env.SEGREDO; }
});
