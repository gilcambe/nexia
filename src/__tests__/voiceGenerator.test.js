import { describe, test } from 'node:test';
import assert from 'node:assert';

const { generateVoice } = await import('../services/voiceGenerator.js');

const mockAudioBytes1 = new Uint8Array([1, 2, 3, 4, 5]);
const mockAudioBytes2 = new Uint8Array([6, 7, 8, 9, 10]);

function mockFetch(status, body, audioId = 1) {
  return async () => {
    return new Response(body, {
      status,
      headers: { 'Content-Type': 'audio/mpeg' },
    });
  };
}

function mockFetchConcatenated(status, bodies) {
  return async () => {
    // Simular resposta concatenada
    const concatenated = new Uint8Array(bodies.reduce((acc, body) => acc + body.length, 0));
    let offset = 0;
    bodies.forEach(body => {
      concatenated.set(body, offset);
      offset += body.length;
    });
    
    return new Response(concatenated, {
      status,
      headers: { 'Content-Type': 'audio/mpeg' },
    });
  };
}

describe('generateVoice', () => {
  test('retorna blob de áudio com tamanho > 0 e tipo correto', async () => {
    const originalFetch = global.fetch;
    global.fetch = mockFetch(200, mockAudioBytes1);

    try {
      const scenes = [{ text: 'Olá' }, { text: 'Mundo' }];
      const blob = await generateVoice(scenes);

      assert.ok(blob instanceof Blob);
      assert.ok(blob.size > 0);
      assert.strictEqual(blob.type, 'audio/mpeg');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('lida com erros da API TTS', async () => {
    const originalFetch = global.fetch;
    global.fetch = mockFetch(500);

    try {
      const scenes = [{ text: 'Erro' }];
      await assert.rejects(() => generateVoice(scenes), /TTS API error: 500/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('lida com API TTS retornando áudio vazio', async () => {
    const originalFetch = global.fetch;
    global.fetch = mockFetch(200, new Uint8Array([]));

    try {
      const scenes = [{ text: 'Texto vazio' }];
      await assert.rejects(() => generateVoice(scenes), /API TTS retornou áudio vazio/);
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
      await assert.rejects(() => generateVoice([{ text: '' }]), /Cada cena deve ter texto/);
      await assert.rejects(() => generateVoice([{}]), /Cada cena deve ter texto/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('concatena corretamente blobs de áudio', async () => {
    const originalFetch = global.fetch;
    
    // Simular múltiplas chamadas TTS com diferentes blobs
    let callCount = 0;
    global.fetch = async () => {
      callCount++;
      const body = callCount === 1 ? mockAudioBytes1 : mockAudioBytes2;
      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg' },
      });
    };

    try {
      const scenes = [{ text: 'Primeira cena' }, { text: 'Segunda cena' }];
      const blob = await generateVoice(scenes);

      // Verificar que o blob concatenado tem o tamanho esperado
      const expectedSize = mockAudioBytes1.length + mockAudioBytes2.length;
      assert.strictEqual(blob.size, expectedSize);
      assert.strictEqual(blob.type, 'audio/mpeg');
      
      // Verificar que o conteúdo está concatenado
      const arrayBuffer = await blob.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      
      // Primeira parte deve ser igual ao primeiro blob
      for (let i = 0; i < mockAudioBytes1.length; i++) {
        assert.strictEqual(data[i], mockAudioBytes1[i]);
      }
      
      // Segunda parte deve ser igual ao segundo blob
      for (let i = 0; i < mockAudioBytes2.length; i++) {
        assert.strictEqual(data[mockAudioBytes1.length + i], mockAudioBytes2[i]);
      }
    } finally {
      global.fetch = originalFetch;
    }
  });
});
