const test = require('node:test');
const assert = require('node:assert/strict');
const expediente = require('../../lib/expediente');

// Tenta obter a função exportada de forma flexível
const estaAberta =
  typeof expediente === 'function'
    ? expediente
    : expediente.estaAberta || expediente.isOpen || expediente.default;

if (typeof estaAberta !== 'function') {
  throw new Error('O módulo lib/expediente deve exportar uma função (ex.: module.exports = function...).');
}

test('caso comum – segunda-feira às 09:00 está aberto', () => {
  const resultado = estaAberta(1, '09:00'); // 1 = segunda-feira
  assert.equal(resultado, true, 'Deve retornar true para horário dentro do expediente');
});

test('caso de borda – sexta-feira às 18:00 já está fechado', () => {
  const resultado = estaAberta(5, '18:00'); // 5 = sexta-feira
  assert.equal(resultado, false, 'Às 18:00 em ponto o estabelecimento já está fechado');
});

test('entrada inválida – formato de hora incorreto', () => {
  const resultado = estaAberta(2, '25:99'); // hora impossível
  assert.equal(resultado, false, 'Deve retornar false para horário inválido');
});