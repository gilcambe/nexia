'use strict';
const assert = require('assert');
const { parseReset, createPlacar } = require('../../nexia-ai/model-router/cota');

// parseReset
assert.strictEqual(parseReset('2m59.56s'), 179560, '2m59.56s -> 179560 ms');
assert.strictEqual(parseReset('7.66s'), 7660, '7.66s -> 7660 ms');
assert.strictEqual(parseReset('30'), 30000, '30 -> 30000 ms');
assert.strictEqual(parseReset(''), 60000, 'vazio -> 60s');
assert.strictEqual(parseReset(null), 60000, 'null -> 60s');
assert.strictEqual(parseReset(undefined), 60000, 'undefined -> 60s');

// registrarCabecalhos
function testaRegistro(headers) {
  const placar = createPlacar({ agora: () => 1000 });
  const desc = { provider: 'test', model: 'test-model' };
  placar.registrarCabecalhos(desc, headers);
  return placar.bloqueado(desc);
}

assert.strictEqual(
  testaRegistro(new Headers({ 'x-ratelimit-remaining-requests': '0' })),
  true,
  'remaining-requests 0 bloqueia'
);
assert.strictEqual(
  testaRegistro(new Headers({ 'x-ratelimit-remaining-requests': '1' })),
  true,
  'remaining-requests 1 bloqueia'
);
assert.strictEqual(
  testaRegistro(new Headers({ 'x-ratelimit-remaining-tokens': '1999' })),
  true,
  'remaining-tokens < 2000 bloqueia'
);
assert.strictEqual(
  testaRegistro(new Headers({ 'x-ratelimit-remaining-requests': '5', 'x-ratelimit-remaining-tokens': '5000' })),
  false,
  'cota suficiente nao bloqueia'
);
assert.strictEqual(testaRegistro(new Headers({})), false, 'sem headers nao bloqueia');

console.log('Todos os testes de cota passaram.');
