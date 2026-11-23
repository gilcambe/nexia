'use strict';

function processarFila(fila, entregues) {
  if (!Array.isArray(fila)) {
    throw new TypeError('fila deve ser um array');
  }
  if (!Array.isArray(entregues)) {
    throw new TypeError('entregues deve ser um array');
  }

  const jaEntregues = new Set(entregues);
  return fila.filter((item) => !jaEntregues.has(item));
}

module.exports = { processarFila };
