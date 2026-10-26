'use strict';
// #1640: pedido de imagem no chat usa o FLUX grátis do Workers AI.
const test = require('node:test');
const assert = require('node:assert');
const chat = require('../../netlify/functions/cortex-chat.js');

test('reconhece pedido de imagem em português comum', () => {
  for (const t of ['Crie uma imagem de um gato astronauta', 'desenhe um logo para minha padaria', 'Gere uma ilustração de um carro']) assert.ok(chat.PEDE_IMAGEM.test(t), t);
  for (const t of ['Qual a capital da Austrália?', 'Escreva um poema sobre o mar', 'Como melhorar a imagem da minha empresa?']) assert.ok(!chat.PEDE_IMAGEM.test(t), t);
});

test('generateImage usa o binding do Workers AI (FLUX) e devolve data URL', async () => {
  const antes = globalThis.__NEXIA_AI__;
  let modelo = '';
  globalThis.__NEXIA_AI__ = { run: async (m) => { modelo = m; return { image: 'QUJD' }; } };
  try {
    const r = await chat.generateImage('um gato astronauta');
    assert.strictEqual(modelo, '@cf/black-forest-labs/flux-1-schnell');
    assert.deepStrictEqual([r.ok, r.url], [true, 'data:image/jpeg;base64,QUJD']);
  } finally { globalThis.__NEXIA_AI__ = antes; }
});

test('#1657: a memória da conversa é gravada antes do "done" do stream', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../../netlify/functions/cortex-chat.js'), 'utf8');
  const salvar = src.indexOf('await memModule.save(effectiveUserId');
  const done = src.indexOf("yield sse({ done: true, model: used");
  assert.ok(salvar > 0 && done > 0 && salvar < done);
});
