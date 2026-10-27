'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const chat = require('../netlify/functions/cortex-chat');

test('Cortex Chat: rejeita requisição sem token Bearer de autenticação (401)', async () => {
  const event = {
    httpMethod: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: 'Olá, qual é a capital do Brasil?',
      tenantId: 'nexia',
      stream: false
    })
  };

  const res = await chat.handler(event);
  assert.equal(res.statusCode, 401);
});

test('Cortex Chat: constante PEDE_IMAGEM e gerador de imagem', async () => {
  assert.equal(chat.PEDE_IMAGEM.test('crie uma imagem de um gato no espaço'), true);
  assert.equal(chat.PEDE_IMAGEM.test('gerar um logotipo moderno para startup'), true);
  assert.equal(chat.PEDE_IMAGEM.test('como fazer um bolo de chocolate'), false);
});

test('Cortex Chat: fallback de provedor e reserva com Workers AI', async () => {
  const mockWorkersAI = {
    run: async (modelo, opts) => {
      assert.ok(modelo.includes('llama'));
      assert.ok(Array.isArray(opts.messages));
      return { response: 'Resposta de contingência via Workers AI' };
    }
  };

  const resultado = await chat.reservaWorkersAI(
    'Você é um assistente útil.',
    [{ role: 'user', content: 'Teste de fallback' }],
    mockWorkersAI
  );

  assert.ok(resultado);
  assert.equal(resultado.text, 'Resposta de contingência via Workers AI');
  assert.match(resultado.modelo, /Workers AI/);
});

test('Cortex Chat: fallback da reserva quando o modelo primário do Workers AI lança erro', async () => {
  let chamadas = 0;
  const mockWorkersAIComFalha = {
    run: async (modelo) => {
      chamadas++;
      if (modelo.includes('llama-3.3-70b')) {
        throw new Error('Rate limit ou indisponível');
      }
      return { response: 'Resposta do modelo secundário 8b' };
    }
  };

  const resultado = await chat.reservaWorkersAI(
    'Sistema',
    [{ role: 'user', content: 'Oi' }],
    mockWorkersAIComFalha
  );

  assert.equal(chamadas, 2);
  assert.ok(resultado);
  assert.equal(resultado.text, 'Resposta do modelo secundário 8b');
});

test('Cortex Chat: rejeita método HTTP não permitido', async () => {
  const event = {
    httpMethod: 'GET',
    headers: {}
  };

  const res = await chat.handler(event);
  assert.equal(res.statusCode, 405);
});
