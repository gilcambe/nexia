import assert from 'node:assert';
import { utilBarColor } from './utilBarColor.js';

// Testes para utilBarColor
const test = (val, expected, label) => {
  const result = utilBarColor(val);
  assert.strictEqual(result, expected, `${label}: esperava ${expected}, recebeu ${result}`);
};

test(70, 'bg-indigo-500', '70% deve ser azul');
test(70.1, 'bg-amber-500', '70.1% deve ser amarelo');
test(90, 'bg-amber-500', '90% deve ser amarelo');
test(90.1, 'bg-red-500', '90.1% deve ser vermelho');
test(100, 'bg-red-500', '100% deve ser vermelho');

console.log('Todos os testes de utilBarColor passaram!');
