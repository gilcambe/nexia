const { test } = require('node:test'); const assert = require('node:assert');
const { abrirSessao, lerSessao } = require('../lib/sessao');
test('abre e lê a sessão', () => {
  const t = abrirSessao('u1', 'segredo-de-teste-0123456789abcdef');
  assert.strictEqual(lerSessao(t, 'segredo-de-teste-0123456789abcdef'), 'u1');
});
