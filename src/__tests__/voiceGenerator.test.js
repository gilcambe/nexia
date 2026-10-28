import { describe, test } from 'node:test';
import assert from 'node:assert';

const { generateVoice } = await import('../services/voiceGenerator.js');

const mockAudioBytes = new Uint8Array([1, 2, 3, 4, 5]);

function mockFetch(status, body = mockAudioBytes) {
  return async () => {
    return new Response(body, {
      status,
      headers: { 'Content-Type': 'audio/mpeg' },
    });
  };
}

describe('generateVoice', () => {
  test('retorna blob de áudio com tamanho > 0', async () => {
    const originalFetch = global.fetch;
    global.fetch = mockFetch(200);

    try {
      const scenes = [{ text: 'Olá' }, { text: 'Mundo' }];
      const blob = await generateVoice(scenes);

      assert.ok(blob instanceof Blob);
      assert.ok(blob.size > 0);
      assert.ok(blob.type.includes('audio'));
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('lida com erros da API TTS', async () => {
    const originalFetch = global.fetch;
    global.fetch = mockFetch(500);

    try {
      const scenes = [{ text: 'Erro' }];
      await assert.rejects(() => generateVoice(scenes));
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('lança erro se scenes não for um array válido', async () => {
    await assert.rejects(() => generateVoice([]));
    await assert.rejects(() => generateVoice(null));
  });

  test('lança erro se cena não tem texto', async () => {
    const originalFetch = global.fetch;
    global.fetch = mockFetch(200);

    try {
      await assert.rejects(() => generateVoice([{ text: '' }]));
    } finally {
      global.fetch = originalFetch;
    }
  });
});
