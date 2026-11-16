const { test } = require('node:test'); const assert = require('node:assert');
const { criarAvisos } = require('../src/avisos');
test('avisa a conexão do cliente', () => {
  const a = criarAvisos(); const rec = [];
  a.registrar('c1', { enviar: m => rec.push(m) });
  assert.strictEqual(a.avisar('c1', 'oi'), 1);
  assert.deepStrictEqual(rec, ['oi']);
});
