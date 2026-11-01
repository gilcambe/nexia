'use strict';
// #2716: a fila usa as vagas da Central (IA_VAGA_1..50) pelo roteador.
const test = require('node:test');
const assert = require('node:assert/strict');
const { lerVagas, aplicarVagas, vagasCustom, valorCustom, MAX_VAGAS } = require('../../nexia-ai/model-router/vagas');
const { createRouter } = require('../../nexia-ai/model-router');
const { listFor } = require('../../nexia-ai/orchestrator/models');

const custom = valorCustom({ url: 'https://ia.exemplo.com/v1', modelo: 'modelo-gratis', chave: 'sk-custom-123' });

test('VR1. lê as 50 vagas, ignora provedor desconhecido e custom inválido', () => {
  const env = { IA_VAGA_1: 'groq:gsk_a', IA_VAGA_11: 'zai:z1', IA_VAGA_50: custom, IA_VAGA_51: 'groq:fora', IA_VAGA_3: 'inventado:x', IA_VAGA_4: 'custom:lixo' };
  assert.equal(MAX_VAGAS, 50);
  assert.deepEqual(lerVagas(env).map(v => `${v.n}:${v.provedor}`), ['1:groq', '11:zai', '50:custom']);
});

test('VR2. chave da vaga entra só onde o provedor está sem chave (uma conta por provedor)', () => {
  const env = aplicarVagas({ IA_VAGA_2: 'groq:da-vaga', IA_VAGA_5: 'groq:segunda', IA_VAGA_7: 'nvidia:nv', NVIDIA_API_KEY: 'ja-tinha' });
  assert.equal(env.GROQ_API_KEY, 'da-vaga');
  assert.equal(env.NVIDIA_API_KEY, 'ja-tinha');
  const vazio = { X: '1' };
  assert.equal(aplicarVagas(vazio), vazio);
});

test('VR3. roteador usa a chave da vaga e a vaga "Outra IA" vira o provedor vaga-N', async () => {
  const pedidos = [];
  const fetchImpl = async (url, init) => { pedidos.push({ url, auth: init.headers.Authorization }); return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
  const router = createRouter({ env: { IA_VAGA_1: 'groq:gsk_vaga', IA_VAGA_12: custom }, fetchImpl });
  assert.equal(router.capabilities({ provider: 'groq', model: 'llama-3.3-70b-versatile' }).available !== false, true);
  await router.chat({ provider: 'vaga-12', model: 'modelo-gratis' }, { messages: [{ role: 'user', content: 'oi' }], maxTokens: 4 });
  await router.chat({ provider: 'groq', model: 'llama-3.3-70b-versatile' }, { messages: [{ role: 'user', content: 'oi' }], maxTokens: 4 });
  assert.equal(pedidos[0].url, 'https://ia.exemplo.com/v1/chat/completions');
  assert.equal(pedidos[0].auth, 'Bearer sk-custom-123');
  assert.equal(pedidos[1].auth, 'Bearer gsk_vaga');
});

test('VR4. "Outra IA" entra primeiro na cadeia de toda classe', () => {
  const env = { IA_VAGA_9: custom };
  assert.deepEqual(listFor('coding', env)[0], { provider: 'vaga-9', model: 'modelo-gratis' });
  assert.deepEqual(vagasCustom(env).map(c => c.provider), ['vaga-9']);
  assert.ok(listFor('coding', {}).every(d => !String(d.provider).startsWith('vaga-')));
});
