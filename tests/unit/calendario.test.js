import test from 'node:test';
import assert from 'node:assert';
import { SEMANA, temaDoDia } from '../../src/lib/calendario.ts';

test('calendario: SEMANA deve conter os 7 dias da semana', () => {
  assert.strictEqual(SEMANA.length, 7);
  assert.deepStrictEqual(SEMANA, ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']);
});

test('calendario: temaDoDia deve retornar o tema correto para cada dia', () => {
  assert.strictEqual(temaDoDia('Domingo'), 'Descanso e inspiração');
  assert.strictEqual(temaDoDia('Segunda'), 'Planejamento da semana');
  assert.strictEqual(temaDoDia('Terça'), 'Dicas de produtividade');
  assert.strictEqual(temaDoDia('Quarta'), 'Meio da semana – foco');
  assert.strictEqual(temaDoDia('Quinta'), 'Feedback e ajustes');
  assert.strictEqual(temaDoDia('Sexta'), 'Celebrar conquistas');
  assert.strictEqual(temaDoDia('Sábado'), 'Relaxar e refletir');
});

test('calendario: temaDoDia lida com entradas inválidas', () => {
  assert.strictEqual(temaDoDia('Dia inválido'), '');
  assert.strictEqual(temaDoDia(''), '');
  assert.strictEqual(temaDoDia('NaoExiste'), '');
});
