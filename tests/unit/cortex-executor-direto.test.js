'use strict';
// Cortex v2 (11/11/2026): pedido que JÁ nomeia os arquivos vai direto para o especialista, sem o Architect
// (que estourava MAX_STEPS). Revisão e segurança continuam. Pedido sem arquivo continua com análise.
const test = require('node:test');
const assert = require('node:assert/strict');
const { planFor } = require('../../nexia-ai/orchestrator/index.js');

const agentes = p => p.map(s => s.agent + ':' + s.action);

test('EXD1. pedido com arquivo concreto: sem Architect (que estourava MAX_STEPS); revisão e segurança mantidas', () => {
  const p = planFor('change', 'Corrija o texto do botão em src/pages/central/Painel.tsx para "Salvar"');
  const a = agentes(p);
  assert.ok(!a.some(x => x.startsWith('architect')), a.join(' | '));
  assert.deepEqual(p.map(s => s.action), ['create_branch', 'agent:implement', 'agent:review', 'agent:security', 'create_pr', 'checks']);
});

test('EXD2. pedido SEM arquivo: mantém a análise do Architect e as revisões', () => {
  const p = planFor('change', 'Melhore a mensagem de erro quando o login falha');
  const a = agentes(p);
  assert.ok(a[0].startsWith('architect'), a.join(' | '));
  assert.ok(a.some(x => x.startsWith('reviewer')) && a.some(x => x.startsWith('security')));
});

test('EXD3. site novo (Site Kit) não muda', () => {
  const p = planFor('change', 'Crie um site para a padaria do João');
  assert.ok(p.some(s => s.action === 'design_spec'));
  assert.ok(p.some(s => s.agent === 'reviewer'));
});
