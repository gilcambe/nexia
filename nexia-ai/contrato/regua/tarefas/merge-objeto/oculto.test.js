const assert = require('node:assert');
const { mergeObjeto } = require('./solucao');

const obj1 = { a: 1, nested: { x: 10 } };
const obj2 = { nested: { y: 20 }, d: 5 };

const resultado = mergeObjeto(obj1, obj2);

assert.strictEqual(resultado.a, 1);
assert.deepStrictEqual(resultado.nested, { x: 10, y: 20 });
assert.strictEqual(resultado.d, 5);

console.log('Teste oculto passou!');
