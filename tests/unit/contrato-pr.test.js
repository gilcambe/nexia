'use strict';
// 12/11: 9 tarefas entregues pelo contrato ficaram abertas ("Fecha #N" em português não fecha no GitHub) e o PR do
// contrato nunca entrava sozinho (ramo cortex/contrato-*; o merge automático só olha nexia/*).
const test = require('node:test');
const assert = require('node:assert/strict');
const { ramoDoContrato, corpoDoPr } = require('../../nexia-ai/contrato/pr');

test('CP1. ramo do contrato começa com nexia/ (entra no merge automático autorizado, ADR-OPS-02)', () => {
  const r = ramoDoContrato(3522, 1700000000000);
  assert.match(r, /^nexia\/contrato-3522-[a-z0-9]+$/);
  assert.notEqual(ramoDoContrato(3522, 1700000000000), ramoDoContrato(3522, 1700000000001));
  assert.throws(() => ramoDoContrato('x'));
});

test('CP2. corpo do PR fecha a issue no GitHub (Closes) e mantém "Fecha #N" que a Central lê', () => {
  const b = corpoDoPr({ numero: 3522, teste: 'node --test tests/unit/a.test.js', modelo: 'groq/x', tentativas: 2, seg: 30, arquivos: ['lib/a.js'], hist: 'h' });
  assert.match(b, /^Fecha #3522$/m);
  assert.match(b, /^Closes #3522$/m);
  assert.match(b, /`lib\/a\.js`/);
  assert.match(b, /node --test tests\/unit\/a\.test\.js/);
});
