'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { decidir } = require('../../scripts/cortex-fila');

test('urgente vence sozinho após 48h vira ação urgente-vence', () => {
  const agora = Date.now();
  const tresDiasAtras = new Date(agora - 3 * 24 * 3600 * 1000).toISOString();
  const umDiaAtras = new Date(agora - 24 * 3600 * 1000).toISOString();

  const issues = [
    { number: 1, labels: ['cortex-fila', 'cortex-urgente'], created_at: tresDiasAtras, author_association: 'OWNer', state: 'open' },
    { number: 2, labels: ['cortex-fila', 'cortex-urgente'], created_at: umDiaAtras, author_association: 'OWNER', state: 'open' },
    { number: 3, labels: ['cortex-fila', 'cortex-urgente', 'cortex-rodando'], created_at: tresDiasAtras, author_association: 'OWNER', state: 'open' }
  ];

  const acoes = decidir({ issues, runs: [], agora });
  const vence = acoes.filter(a => a.tipo === 'urgente-vence');
  
  assert.strictEqual(vence.length, 1);
  assert.strictEqual(vence[0].numero, 1);
});

test('limite de 20 ações urgente-vence por ciclo', () => {
  const agora = Date.now();
  const tresDiasAtras = new Date(agora - 3 * 24 * 3600 * 1000).toISOString();

  const issues = [];
  for (let i = 1; i <= 25; i++) {
    issues.push({ number: i, labels: ['cortex-fila', 'cortex-urgente'], created_at: tresDiasAtras, author_association: 'OWNER', state: 'open' });
  }

  const acoes = decidir({ issues, runs: [], agora });
  const vence = acoes.filter(a => a.tipo === 'urgente-vence');

  assert.strictEqual(vence.length, 20);
});
