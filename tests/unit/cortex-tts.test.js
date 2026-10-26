'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createHandler } = require('../../netlify/functions/cortex-tts');

const mwOk = { verifyBearerToken: async () => ({ ok: true, role: 'master' }) };
const mwFail = { verifyBearerToken: async () => ({ ok: false }) };

test('TTS1. sem autorização master -> 403', async () => {
  const handler = createHandler({ getMw: () => mwFail });
  const res = await handler({ httpMethod: 'POST', body: JSON.stringify({ texto: 'Olá' }) });
  assert.strictEqual(res.statusCode, 403);
});

test('TTS2. sem texto -> 400', async () => {
  const handler = createHandler({ getMw: () => mwOk });
  const res = await handler({ httpMethod: 'POST', body: JSON.stringify({ texto: '' }) });
  assert.strictEqual(res.statusCode, 400);
});

test('TTS3. Workers AI binding nativo gera áudio wav em base64', async () => {
  const env = {
    AI: {
      run: async (model, body) => {
        assert.strictEqual(model, '@cf/myshell-ai/melotts');
        assert.strictEqual(body.text, 'Testando TTS');
        return Buffer.from('AUDIO_WAV_BYTES');
      },
    },
  };
  const handler = createHandler({ getMw: () => mwOk, env });
  const res = await handler({ httpMethod: 'POST', body: JSON.stringify({ texto: 'Testando TTS' }) });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.headers['Content-Type'], 'audio/wav');
  assert.strictEqual(res.isBase64Encoded, true);
  assert.strictEqual(Buffer.from(res.body, 'base64').toString('utf8'), 'AUDIO_WAV_BYTES');
});

test('TTS4. Workers AI REST fallback gera áudio wav', async () => {
  const env = { CLOUDFLARE_AI_ACCOUNT_ID: 'acc123', CLOUDFLARE_AI_TOKEN: 'tok123' };
  const fetchImpl = async (url) => {
    assert.ok(String(url).includes('/ai/run/@cf/myshell-ai/melotts'));
    const buf = Buffer.from('REST_AUDIO_DATA');
    return {
      ok: true,
      arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    };
  };
  const handler = createHandler({ getMw: () => mwOk, env, fetchImpl });
  const res = await handler({ httpMethod: 'POST', body: JSON.stringify({ texto: 'Fallback REST' }) });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(Buffer.from(res.body, 'base64').toString('utf8'), 'REST_AUDIO_DATA');
});
