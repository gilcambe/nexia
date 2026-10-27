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

test('C6d. otimizacao de historico preserva as 4 ultimas mensagens e gera resumo/fallback quando estoura tokens', async () => {
  const { estimarTokens, otimizarHistorico } = require('../../lib/cortex-tokens');

  assert.equal(typeof estimarTokens, 'function');
  assert.equal(typeof otimizarHistorico, 'function');

  // Histórico curto não deve ser alterado
  const curto = [
    { role: 'user', content: 'Olá' },
    { role: 'assistant', content: 'Oi, tudo bem?' }
  ];
  const optCurto = await otimizarHistorico(curto, { budgetTokens: 100, keepRecent: 4 });
  assert.equal(optCurto.summarized, false);
  assert.equal(optCurto.messages.length, 2);

  // Histórico longo excedendo o orçamento
  const longo = [];
  for (let i = 1; i <= 10; i++) {
    longo.push({ role: 'user', content: `Mensagem de teste número ${i} com conteúdo longo para forçar estouro de orçamento.` });
    longo.push({ role: 'assistant', content: `Resposta de teste número ${i} também detalhada para inflar o contador de tokens.` });
  }

  const optLongo = await otimizarHistorico(longo, { budgetTokens: 100, keepRecent: 4 });
  assert.equal(optLongo.summarized, true);
  // Deve ter 1 mensagem de resumo + 4 últimas mensagens = 5 itens
  assert.equal(optLongo.messages.length, 5);
  assert.equal(optLongo.messages[0].role, 'system');
  assert.match(optLongo.messages[0].content, /Resumo/);

  // Confirma que as 4 últimas mensagens do histórico original foram preservadas na íntegra
  const ultimas4Originais = longo.slice(-4);
  const ultimas4Otimizadas = optLongo.messages.slice(1);
  assert.deepEqual(ultimas4Otimizadas, ultimas4Originais);

  assert.ok(optLongo.tokensBefore > optLongo.tokensAfter);
});
