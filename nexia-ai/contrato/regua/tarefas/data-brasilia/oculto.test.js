const { obterDataBrasilia } = require('./solucao');
const assert = require('assert');

// Teste com datas específicas
const dataBase = new Date('2023-10-01T12:00:00Z');
const brasilia = obterDataBrasilia(dataBase);

assert.strictEqual(brasilia.toISOString(), '2023-10-01T09:00:00.000Z', 'Deve subtrair 3 horas corretamente');

console.log('Teste oculto passou!');
