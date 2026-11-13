'use strict';
// Fase 6 (13/11/2026): Consultor "?" da Central — só IA grátis, pula a que falha, nunca usa Claude.
const test = require('node:test');
const assert = require('node:assert/strict');
const { consultor, rota } = require('../../netlify/functions/central/ferramentas');
const { FREE } = require('../../nexia-ai/orchestrator/models');

test('FE1. consultor: pergunta vazia = 400; lista de modelos não tem Claude', async () => {
  assert.equal((await consultor({ pergunta: ' ' }, { router: {} })).status, 400);
  assert.ok(FREE.fast.length > 0 && FREE.fast.every((d) => d.provider !== 'anthropic'));
});

test('FE2. consultor: IA que falha é pulada; a próxima responde', async () => {
  const chamadas = [];
  const router = {
    capabilities: () => ({ available: true }),
    chat: async (d, o) => { chamadas.push(d.model); assert.match(o.system, /leigo/); if (chamadas.length === 1) throw new Error('429'); return { text: '1. Abra a tela Clientes.' }; },
  };
  const modelos = [{ provider: 'groq', model: 'a' }, { provider: 'openrouter', model: 'b' }];
  const r = await rota({ acao: 'ferramentas-consultor', body: { pergunta: 'como clono um site?', tela: 'Início' } }, { router, modelos });
  assert.equal(r.status, 200); assert.equal(r.corpo.resposta, '1. Abra a tela Clientes.'); assert.equal(r.corpo.modelo, 'openrouter/b');
});

test('FE3. consultor: nenhuma IA disponível = 503 com o que fazer; ação desconhecida = null', async () => {
  const router = { capabilities: () => ({ available: false }), chat: async () => ({ text: 'x' }) };
  const r = await consultor({ pergunta: 'oi tudo bem' }, { router, modelos: [{ provider: 'groq', model: 'a' }] });
  assert.equal(r.status, 503); assert.match(r.corpo.error, /IA & Cortex/);
  assert.equal(await rota({ acao: 'ferramentas-x', body: {} }, {}), null);
});
