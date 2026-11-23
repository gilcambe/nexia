const assert = require('node:assert');
const { mergeObjeto } = require('./solucao');

const obj1 = { a: 1, b: 2 };
const obj2 = { b: 3, c: 4 };

const resultado = mergeObjeto(obj1, obj2);

assert.strictEqual(resultado.a, 1);
assert.strictEqual(resultado.b, 3);
assert.strictEqual(resultado.c, 4);

console.log('Teste visível passou!');
