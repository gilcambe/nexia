'use strict';
// 17/11, celular do dono: o pdf.js não abria o PDF do holerite. Agora o PDF pode ir CRU para salario_ler e o leitor
// manda ao Gemini (lê PDF) e à Cloudflare (PDF → texto → IA de texto). Outras telas continuam só com imagem.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const visao = require('../../netlify/functions/prumo-lib/visao');
const p = require('../../netlify/functions/prumo.js');

const PDF = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4 holerite').toString('base64');
const JSON_OK = '{"tipo":"mensal","mes":"2026-11","bruto":7000,"liquido":5883.37}';

test('lerImagens: PDF cru só entra quando a tela pede', () => {
  assert.equal(p.lerImagens([PDF]).ok, false);
  const r = p.lerImagens([PDF], { pdf: true });
  assert.equal(r.ok, true);
  assert.equal(r.imagens[0].mime, 'application/pdf');
});

test('PDF vai ao Gemini com inline_data application/pdf e a resposta volta', async () => {
  const pedidos = [];
  const deps = {
    env: { GEMINI_API_KEY: 'x' }, ai: null, getRouter: () => null, esperaCorridaMs: 5,
    fetch: async (url, o) => { pedidos.push({ url, corpo: JSON.parse(o.body), chave: o.headers['x-goog-api-key'] }); return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON_OK }] } }] }) }; },
  };
  const t = await visao.perguntarVisao(deps, { mime: 'application/pdf', data: PDF.split(',')[1] }, 'sistema', { porIaMs: 2000, totalMs: 5000 });
  assert.equal(t, JSON_OK);
  const parte = pedidos[0].corpo.contents[0].parts[0];
  assert.equal(parte.inline_data.mime_type, 'application/pdf');
  assert.match(pedidos[0].url, /generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-/);
});

test('sem Gemini, a Cloudflare tira o texto do PDF e uma IA de texto lê', async () => {
  const deps = {
    env: {}, esperaCorridaMs: 5, listFor: () => [{ provider: 'groq', model: 'm' }],
    ai: { toMarkdown: async () => [{ data: 'HOLERITE novembro 2026 Salário líquido 5.883,37 bruto 7.000,00' }] },
    getRouter: () => ({ chat: async (d, req) => { assert.match(req.messages[0].content, /5\.883,37/); return { text: JSON_OK }; }, capabilities: () => ({ available: true, vision: true }) }),
  };
  const t = await visao.perguntarVisao(deps, { mime: 'application/pdf', data: 'AAAA' }, 'sistema', { porIaMs: 2000, totalMs: 5000 });
  assert.equal(t, JSON_OK);
});

test('tela do salário manda o PDF cru quando o celular não converte', () => {
  const s = fs.readFileSync(path.join(__dirname, '../../prumo/orcamento.js'), 'utf8');
  assert.match(s, /lerCru\(a\)/);
  assert.match(s, /data:application\/pdf;/);
  assert.match(fs.readFileSync(path.join(__dirname, '../../netlify/functions/prumo-lib/salario.js'), 'utf8'), /lerImagens\(body\.imagens, \{ pdf: true \}\)/);
});
