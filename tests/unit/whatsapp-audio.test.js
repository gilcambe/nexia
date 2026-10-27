'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { transcreverAudioWhatsApp } = require('../../netlify/functions/whatsapp-business');

test('WA1. sem mediaId ou sem token -> devolve null', async () => {
  assert.strictEqual(await transcreverAudioWhatsApp('', 'token'), null);
  assert.strictEqual(await transcreverAudioWhatsApp('media123', ''), null);
});

test('WA2. transcreve áudio do WhatsApp com sucesso', async () => {
  const fetchImpl = async (url) => {
    if (String(url).includes('graph.facebook.com')) {
      return {
        ok: true,
        json: async () => ({ url: 'https://lookaside.fbsbx.com/whatsapp/media/123' }),
      };
    }
    if (String(url).includes('lookaside.fbsbx.com')) {
      const buf = Buffer.from('AUDIO_OGG_BYTES');
      return {
        ok: true,
        arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      };
    }
    return { ok: false };
  };

  const entenderImpl = async (anexo) => {
    assert.strictEqual(anexo.nome, 'whatsapp.ogg');
    assert.strictEqual(anexo.tipo, 'audio/ogg');
    assert.strictEqual(Buffer.from(anexo.base64, 'base64').toString('utf8'), 'AUDIO_OGG_BYTES');
    return { tipo: 'audio', texto: 'mensagem de voz enviada pelo cliente no whatsapp' };
  };

  const texto = await transcreverAudioWhatsApp('media123', 'token123', fetchImpl, entenderImpl);
  assert.strictEqual(texto, 'mensagem de voz enviada pelo cliente no whatsapp');
});

test('WA3. falha no Graph API ou no download -> devolve null sem lançar exceção', async () => {
  const fetchImpl = async () => ({ ok: false });
  const entenderImpl = async () => ({ tipo: 'audio', texto: 'não chama' });

  const texto = await transcreverAudioWhatsApp('media123', 'token123', fetchImpl, entenderImpl);
  assert.strictEqual(texto, null);
});
