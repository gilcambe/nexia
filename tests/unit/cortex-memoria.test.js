'use strict';
// #824 (Melhoria C6): memória do Cortex (decisões do dono) lida a cada pedido.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { DECISOES, TEXTO } = require('../../nexia-ai/orchestrator/decisoes-dono');
const { AGENTS, systemPrompt } = require('../../nexia-ai/orchestrator/agents');

test('C6a. a memória tem as regras do dono: nada pago, ícone do produto, português simples', () => {
  const t = DECISOES.join(' ');
  assert.match(t, /Nada pago/);
  assert.match(t, /PRÓPRIO produto/);
  assert.match(t, /Português simples/);
});

test('C6b. todo agente da fila lê a memória no prompt', () => {
  for (const id of Object.keys(AGENTS)) assert.ok(systemPrompt(id, '').includes(TEXTO), id);
});

test('C6c. as respostas diretas do app (cortex-chat) também levam a memória', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../netlify/functions/cortex-chat.js'), 'utf8');
  assert.match(src, /require\('\.\.\/\.\.\/nexia-ai\/orchestrator\/decisoes-dono'\)/);
  assert.match(src, /\$\{DECISOES_DONO\}/);
});
