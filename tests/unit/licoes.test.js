'use strict';
const { LICOES } = require('../../nexia-ai/orchestrator/licoes.js');

test('lição sobre detectar workflow por arquivos modificados está presente', () => {
  const licaoEsperada = "Detectar 'mexe em workflow' pelos arquivos que a tarefa muda, nunca por qualquer citação no texto; IA que falha passa para a próxima, nunca para o dono antes de esgotar todas.";
  expect(LICOES).toContain(licaoEsperada);
});
