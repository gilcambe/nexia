import { assert } from 'node:assert';
import { utilBarColor } from '../src/central/utilBarColor.js';

test('utilBarColor devolve vermelho acima de 90%', () => {
  assert.strictEqual(utilBarColor(91), 'bg-red-500');
  assert.strictEqual(utilBarColor(100), 'bg-red-500');
  assert.strictEqual(utilBarColor(90), 'bg-amber-500');
});

test('utilBarColor devolve amarelo acima de 70%', () => {
  assert.strictEqual(utilBarColor(71), 'bg-amber-500');
  assert.strictEqual(utilBarColor(80), 'bg-amber-500');
  assert.strictEqual(utilBarColor(70), 'bg-indigo-500');
});

test('utilBarColor devolve indigo abaixo ou igual a 70%', () => {
  assert.strictEqual(utilBarColor(0), 'bg-indigo-500');
  assert.strictEqual(utilBarColor(50), 'bg-indigo-500');
  assert.strictEqual(utilBarColor(70), 'bg-indigo-500');
});
