const { test } = require('node:test'); const assert = require('node:assert'); const fs = require('node:fs'); const path = require('node:path');
const { abrirSessao, lerSessao } = require('../lib/sessao'); const token = require('../lib/token');
const S = 'segredo-de-teste-0123456789abcdef';
test('usa o módulo pronto lib/token.js (require) e não cria HMAC próprio', () => {
  const src = fs.readFileSync(path.join(__dirname, '../lib/sessao.js'), 'utf8');
  assert.match(src, /require\(['"]\.\/token(\.js)?['"]\)/); assert.doesNotMatch(src, /createHmac/);
});
test('o token é validado pelo módulo pronto', () => { assert.strictEqual(token.validar(abrirSessao('u2', S), S).usuarioId, 'u2'); });
test('segredo errado e token adulterado: null', () => {
  const t = abrirSessao('u3', S);
  assert.strictEqual(lerSessao(t, S + 'x'), null);
  assert.strictEqual(lerSessao(t.slice(0, -2) + (t.endsWith('aa') ? 'bb' : 'aa'), S), null);
  assert.strictEqual(lerSessao('', S), null);
});
test('expirado: null', () => { assert.strictEqual(lerSessao(abrirSessao('u4', S, -1), S), null); });
