const { obterDataBrasilia } = require('./solucao');
const assert = require('assert');

// Teste básico de conversão
const agora = new Date();
const brasillia = obterDataBrasilia(agora);
const diff = agora.getTime() - brasillia.getTime();

// Verifica se a diferença é de aproximadamente 3 horas
const tresHorasEmMs = 3 * 60 * 60 * 1000;
assert.ok(Math.abs(diff - tresHorasEmMs) < 1000, 'Diferença deve ser de 3 horas');

console.log('Teste visível passou!');
