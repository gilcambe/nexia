'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { avaliarModelos, ordemDeTentativa } = require('../../nexia-ai/cortex/avaliacao');

const rep = (modelo, oks) => oks.map(ok => ({ modelo, ok }));

test('CA1. ordena do melhor para o pior pela taxa e desempata por total', () => {
  const r = avaliarModelos([...rep('a', [true, false, false]), ...rep('b', [true, true, true]), ...rep('c', [true, true, true, true]), ...rep('d', [true, true, false])]);
  assert.deepEqual(r.map(x => x.modelo), ['c', 'b', 'd', 'a']);
  assert.deepEqual(r[0], { modelo: 'c', total: 4, acertos: 4, taxa: 1 });
});

test('CA2. ignora modelos com menos de 3 execuções', () => {
  const r = avaliarModelos([...rep('raro', [true, true]), ...rep('ok', [true, false, true])]);
  assert.deepEqual(r.map(x => x.modelo), ['ok']);
  assert.deepEqual(avaliarModelos([]), []);
  assert.deepEqual(avaliarModelos(undefined), []);
});

test('CA3. ordemDeTentativa reordena pela taxa e deixa os sem avaliação no fim na ordem original', () => {
  const av = avaliarModelos([...rep('b', [true, true, true]), ...rep('a', [true, false, false])]);
  assert.deepEqual(ordemDeTentativa(av, ['x', 'a', 'y', 'b']), ['b', 'a', 'x', 'y']);
  assert.deepEqual(ordemDeTentativa([], ['x', 'y']), ['x', 'y']);
});
