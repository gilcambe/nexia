'use strict';
// #2847 (parte 1 de #2719): matriz de IAs grátis + conferência semanal do modelo de teste.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { conferir, urlModelos } = require('../../scripts/checkFreeIAModels');
const { conferirModelos } = require('../../scripts/ia-vagas-teste');
const { PROVEDORES } = require('../../netlify/functions/central/ia-vagas');

test('MIA1. matriz cita todos os provedores da Central com link da chave', () => {
  const md = fs.readFileSync(path.join(__dirname, '..', '..', 'docs/MATRIZ-IAS-GRATIS.md'), 'utf8');
  for (const [id, p] of Object.entries(PROVEDORES)) {
    assert.match(md, new RegExp('`' + id + '`'), id);
    if (p.site) assert.ok(md.includes(p.site), `${id}: link ${p.site}`);
  }
  assert.match(md, /Pede cartão\?/);
});

test('MIA2. modelo que sumiu vira aviso; sem chave pula; nunca manda pedido de chat', async () => {
  const urls = [];
  const fetchImpl = async (u, o) => {
    urls.push(u); assert.match(o.headers.Authorization, /^Bearer /);
    if (u.includes('groq')) return { ok: true, json: async () => ({ data: [{ id: 'outro-modelo' }] }) };
    if (u.includes('generativelanguage')) return { ok: true, json: async () => ({ data: [{ id: 'models/gemini-2.5-flash' }] }) };
    return { ok: false, status: 401, json: async () => ({}) };
  };
  const r = await conferir({ env: { GROQ_API_KEY: 'g', GEMINI_API_KEY: 'k', NVIDIA_API_KEY: 'n' }, fetchImpl });
  const por = id => r.find(x => x.id === id);
  assert.equal(por('groq').situacao, 'sumiu');
  assert.equal(por('gemini').situacao, 'ok');
  assert.equal(por('nvidia').situacao, 'erro');
  assert.equal(por('mistral').situacao, 'sem-chave');
  assert.equal(por('custom').situacao, 'nao-confere');
  assert.ok(urls.every(u => u.endsWith('/models')));
  assert.equal(urlModelos('groq'), 'https://api.groq.com/openai/v1/models');
});

test('MIA3. o robô diário confere só às segundas (ou quando pedido)', async () => {
  assert.equal(await conferirModelos({}, new Date('2026-11-03T12:00:00Z')), null);
  const r = await conferirModelos({ IA_CONFERIR_MODELOS: '1' }, new Date('2026-11-03T12:00:00Z'));
  assert.ok(Array.isArray(r));
});
