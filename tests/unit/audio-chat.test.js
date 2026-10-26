'use strict';
const test = require('node:test');
const assert = require('node:assert');
const workerModule = require('../../cloudflare/worker.js');
const worker = workerModule.default || workerModule;

test('AUDIO-CHAT-1. OPTIONS /v1/audio/chat retorna 204 com cabeçalhos CORS', async () => {
  const req = new Request('https://nexia.test/v1/audio/chat', { method: 'OPTIONS' });
  const res = await worker.fetch(req, {});
  assert.strictEqual(res.status, 204);
  assert.strictEqual(res.headers.get('access-control-allow-origin'), '*');
  assert.match(res.headers.get('access-control-allow-methods'), /POST/);
});

test('AUDIO-CHAT-2. Métodos não permitidos retornam 405', async () => {
  const req = new Request('https://nexia.test/v1/audio/chat', { method: 'GET' });
  const res = await worker.fetch(req, {});
  assert.strictEqual(res.status, 405);
});

test('AUDIO-CHAT-3. Requisição sem áudio retorna 400 Bad Request', async () => {
  const req = new Request('https://nexia.test/v1/audio/chat', { method: 'POST', body: new Uint8Array([]) });
  const res = await worker.fetch(req, {});
  assert.strictEqual(res.status, 400);
  const j = await res.json();
  assert.match(j.error, /não fornecido/i);
});

test('AUDIO-CHAT-4. Validar chave de API quando CORTEX_API_KEY está configurado', async () => {
  const env = { CORTEX_API_KEY: 'segredo123' };
  const audioData = new Uint8Array([82, 73, 70, 70, 36, 0, 0, 0, 87, 65, 86, 69]); // RIFF...WAVE mock

  // Sem chave -> 401
  const reqSemChave = new Request('https://nexia.test/v1/audio/chat', { method: 'POST', body: audioData });
  const res401 = await worker.fetch(reqSemChave, env);
  assert.strictEqual(res401.status, 401);

  // Com chave válida -> 200 SSE
  const reqComChave = new Request('https://nexia.test/v1/audio/chat', {
    method: 'POST',
    headers: { Authorization: 'Bearer segredo123' },
    body: audioData,
  });
  const res200 = await worker.fetch(reqComChave, env);
  assert.strictEqual(res200.status, 200);
});

test('AUDIO-CHAT-5. Requisição com .wav binário recebe SSE com transcrição e chunks de áudio reproduzíveis', async () => {
  // Simulando modelo Workers AI (env.AI)
  const env = {
    AI: {
      async run(model, input) {
        if (model.includes('whisper')) {
          return { text: 'Olá Cortex, como você está?' };
        }
        if (model.includes('llama')) {
          return { response: 'Estou funcionando perfeitamente. Como posso ajudar você hoje?' };
        }
        if (model.includes('melotts')) {
          return { audio: Buffer.from(`AUDIO_MOCK:${input.text}`).toString('base64') };
        }
        return {};
      },
    },
  };

  const wavBytes = new Uint8Array([82, 73, 70, 70, 44, 0, 0, 0, 87, 65, 86, 69, 102, 109, 116, 32]);
  const req = new Request('https://nexia.test/v1/audio/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'audio/wav' },
    body: wavBytes,
  });

  const res = await worker.fetch(req, env);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get('content-type'), 'text/event-stream');

  const sseContent = await res.text();
  assert.match(sseContent, /event: transcription/);
  assert.match(sseContent, /Olá Cortex, como você está\?/);
  assert.match(sseContent, /event: audio/);
  assert.match(sseContent, /Estou funcionando perfeitamente/);
  assert.match(sseContent, /event: done/);
});

test('AUDIO-CHAT-6. Requisição multipart/form-data recebe SSE com transcrição e áudio', async () => {
  const env = {
    AI: {
      async run(model, input) {
        if (model.includes('whisper')) return { text: 'Teste de áudio em formulário' };
        if (model.includes('llama')) return { response: 'Tudo certo com o teste.' };
        if (model.includes('melotts')) return { audio: 'c29tX3RhZ3M=' };
        return {};
      },
    },
  };

  const formData = new FormData();
  const file = new File([new Uint8Array([1, 2, 3, 4])], 'teste.wav', { type: 'audio/wav' });
  formData.append('file', file);

  const req = new Request('https://nexia.test/v1/audio/chat', {
    method: 'POST',
    body: formData,
  });

  const res = await worker.fetch(req, env);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get('content-type'), 'text/event-stream');

  const text = await res.text();
  assert.match(text, /Teste de áudio em formulário/);
  assert.match(text, /Tudo certo com o teste/);
  assert.match(text, /c29tX3RhZ3M=/);
});
