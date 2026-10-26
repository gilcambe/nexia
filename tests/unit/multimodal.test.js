'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { processarMultimodal } = require('../../nexia-ai/cortex/multimodal');

test('processarMultimodal com Gemini bem sucedido', async () => {
  const env = { GEMINI_API_KEY: 'fake-key' };
  const fetchImpl = async (url, opts) => {
    assert.match(url, /generativelanguage\.googleapis\.com/);
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Resposta multimodal do Gemini' }] } }]
      })
    };
  };

  const anexos = [
    { nome: 'grafico.png', tipo: 'image/png', base64: Buffer.from('fake-png').toString('base64') },
    { nome: 'audio.mp3', tipo: 'audio/mp3', base64: Buffer.from('fake-audio').toString('base64') }
  ];

  const res = await processarMultimodal({
    env, fetchImpl, mensagem: 'Explique os arquivos', anexos
  });

  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.provedor, 'gemini');
  assert.strictEqual(res.resposta, 'Resposta multimodal do Gemini');
});

test('processarMultimodal com fallback para Workers AI quando Gemini falha', async () => {
  const env = { CLOUDFLARE_AI_TOKEN: 'token', CLOUDFLARE_AI_ACCOUNT_ID: 'account' };
  const fetchImpl = async (url, opts) => {
    if (url.includes('generativelanguage')) {
      return { ok: false, status: 500 };
    }
    return {
      ok: true,
      json: async () => ({ success: true, result: { text: 'Transcrição do áudio' } })
    };
  };

  const anexos = [
    { nome: 'audio.mp3', tipo: 'audio/mp3', base64: Buffer.from('fake-audio').toString('base64') }
  ];

  const res = await processarMultimodal({
    env, fetchImpl, mensagem: 'Ouça', anexos
  });

  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.provedor, 'workers-ai');
  assert.match(res.resposta, /Transcrição do áudio/);
});
