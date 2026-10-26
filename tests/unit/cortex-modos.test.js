'use strict';
// #831 (Melhoria C13): modos Rápido / Pensar / Pesquisar no composer do Cortex.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { MODOS, modoValido, buscarWeb } = require('../../nexia-ai/cortex/modos');
const R = f => fs.readFileSync(path.join(__dirname, '../..', f), 'utf8');

test('C13a. cada modo leva a um tipo de modelo grátis; modo desconhecido é ignorado', () => {
  assert.equal(MODOS.rapido.intent, 'fast');
  assert.equal(MODOS.pensar.intent, 'reasoning');
  assert.equal(MODOS.pesquisar.web, true);
  assert.equal(modoValido('pesquisar'), 'pesquisar');
  assert.equal(modoValido('toString'), null);
  assert.equal(modoValido(undefined), null);
  const { AI_CATALOG } = require('../../netlify/functions/cortex-chat');
  const src = R('netlify/functions/cortex-chat.js');
  for (const m of Object.values(MODOS)) {
    const chave = new RegExp(`\\n  ${m.intent}:\\s+'([a-z0-9_]+)'`).exec(src)[1];
    assert.equal(AI_CATALOG[chave].free, true, `${m.intent} → ${chave} é grátis`);
  }
});

test('C13b. Pesquisar junta DuckDuckGo, Google News e Wikipédia sem chave; sem rede devolve aviso de busca vazia', async () => {
  const fetchImpl = async url => {
    if (url.includes('duckduckgo')) return { ok: true, text: async () => '<a class="result__a" href="https://x">Brasília</a><div class="result__snippet">capital federal</div>' };
    return { ok: true, json: async () => ({ query: { search: [] } }) };
  };
  const t = await buscarWeb('capital do Brasil', fetchImpl);
  assert.match(t, /Brasília/);
  const semRede = await buscarWeb('x', async () => { throw new Error('sem rede'); });
  assert.match(semRede, /não encontrei fontes agora/i);
});

test('C13c. o modo vai do composer até o servidor (só em "Perguntar agora")', () => {
  assert.match(R('src/pages/cortex/Composer.tsx'), /modo === "pergunta" && <div data-testid="cx-modos"/);
  assert.match(R('src/pages/cortex/Pergunta.tsx'), /conversationId: conversa, modo \}/);
  assert.match(R('src/services/api.ts'), /payload\.modo \? \{ modo: payload\.modo \}/);
  assert.match(R('netlify/functions/cortex-chat.js'), /modos\.modoValido\(body\.modo\)/);
});
