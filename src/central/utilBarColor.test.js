import test from 'node:test';
import assert from 'node:assert/strict';
import { utilBarColor } from './utilBarColor.js';

test('utilBarColor: até 70% fica azul (normal)', () => {
  assert.equal(utilBarColor(0), 'bg-indigo-500');
  assert.equal(utilBarColor(70), 'bg-indigo-500');
});

test('utilBarColor: acima de 70% fica amarelo (atenção)', () => {
  assert.equal(utilBarColor(70.1), 'bg-amber-500');
  assert.equal(utilBarColor(90), 'bg-amber-500');
});

test('utilBarColor: acima de 90% fica vermelho (crítico)', () => {
  assert.equal(utilBarColor(90.1), 'bg-red-500');
  assert.equal(utilBarColor(100), 'bg-red-500');
});
