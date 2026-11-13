'use strict';
// Livro de lições: quem escreve código recebe as lições; quem só lê ou revisa não.
const test = require('node:test');
const assert = require('node:assert');
const { systemPrompt } = require('../../nexia-ai/orchestrator/agents');
const { LICOES } = require('../../nexia-ai/orchestrator/licoes');

test('CL1. agentes que gravam código recebem as lições aprendidas', () => {
  for (const id of ['coder', 'frontend', 'backend', 'database']) {
    const p = systemPrompt(id, '');
    assert.match(p, /LIÇÕES APRENDIDAS/, id);
    assert.match(p, /router\.complete/, id);
  }
});

test('CL2. agentes que só leem não recebem, e cada lição é uma frase curta', () => {
  assert.doesNotMatch(systemPrompt('architect', ''), /LIÇÕES APRENDIDAS/);
  assert.doesNotMatch(systemPrompt('qa', ''), /LIÇÕES APRENDIDAS/);
  assert.ok(LICOES.length >= 5);
  for (const l of LICOES) assert.ok(l.length > 20 && l.length < 400, l);
});

test('CL3. lição "ler a árvore antes" está no fim da lista, uma vez só (#3569/#3696 refaziam o arquivo inteiro)', () => {
  const alvo = LICOES.filter((l) => l.startsWith('Nunca planejar arquivo em pasta que o produto não usa; ler a árvore antes'));
  assert.equal(alvo.length, 1);
  assert.equal(LICOES[LICOES.length - 1], alvo[0]);
});
