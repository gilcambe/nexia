'use strict';
// Mocks para testes de estado de tarefas

/**
 * Monta uma issue com a lista de rótulos recebida.
 * @param {string[]} labels
 * @param {object} extra - campos extras (state, updated_at, pull_request_files, pull_request_number, ...)
 */
function issue(labels = [], extra = {}) {
  const agora = Date.now();
  return {
    state: 'open',
    updated_at: new Date(agora).toISOString(),
    labels: labels.map((name) => ({ name })),
    ...extra,
  };
}

module.exports = {
  issue,
  issueExemplo: {
    state: 'open',
    labels: [{ name: 'cortex-fila' }],
  },
};
