const { test } = require('node:test'); const assert = require('node:assert');
const { criarAvisos } = require('../src/avisos');
test('outro cliente NÃO recebe', () => {
  const a = criarAvisos(); const r1 = [], r2 = [];
  a.registrar('c1', { enviar: m => r1.push(m) }); a.registrar('c2', { enviar: m => r2.push(m) });
  assert.strictEqual(a.avisar('c1', 'x'), 1); assert.deepStrictEqual(r2, []);
});
test('várias conexões do mesmo cliente recebem', () => {
  const a = criarAvisos(); const r = [];
  a.registrar('c1', { enviar: m => r.push('a' + m) }); a.registrar('c1', { enviar: m => r.push('b' + m) });
  assert.strictEqual(a.avisar('c1', '1'), 2); assert.deepStrictEqual(r.sort(), ['a1', 'b1']);
});
test('cliente sem conexão: 0, sem erro', () => { assert.strictEqual(criarAvisos().avisar('zz', 'x'), 0); });
test('instâncias separadas não se misturam', () => {
  const a = criarAvisos(), b = criarAvisos(); const r = [];
  a.registrar('c1', { enviar: m => r.push(m) }); assert.strictEqual(b.avisar('c1', 'x'), 0); assert.deepStrictEqual(r, []);
});
