'use strict';
// Teste de fallback do cortex-chat quando o primeiro provedor retorna 429
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { createFakeLLM } = require('../fake-llm');
const { createRouter, validate, CODES, PROVIDER_IDS } = require('../../nexia-ai/model-router');
const { normalizeRequest } = require('../../nexia-ai/model-router/messages');
const { writeStream } = require('../../lib/stream-response');

const ENV = { ANTHROPIC_API_KEY: 'chave-de-teste-anthropic', GROQ_API_KEY: 'chave-de-teste-groq', OPENAI_API_KEY: 'chave-de-teste-openai', GEMINI_API_KEY: 'chave-de-teste-gemini' };
const CLAUDE = { provider: 'anthropic', model: 'claude-sonnet-4-6' };
const GROQ = { provider: 'groq', model: 'llama-3.3-70b-versatile' };
let fake;
let router;

test.before(async () => {
  fake = await createFakeLLM().start();
  router = createRouter({ env: ENV, baseUrls: fake.baseUrls() });
});
test.after(() => fake.close());
test.beforeEach(() => {
  Object.assign(fake.state, { requests: [], text: ['Olá', ', mundo', '!'], toolInput: null, status: {}, gate: null, failMidStream: false });
  fake.resetFirst();
});

const last = () => fake.state.requests[fake.state.requests.length - 1];
const collect = async it => { const out = []; for await (const e of it) out.push(e); return out; };

test('fallback: provedor primário retorna 429, resposta do provedor subsequente', async () => {
  // Configura o provedor primário para retornar 429
  fake.state.status.anthropic = 429;
  
  // Configura o provedor subsequente para responder normalmente
  fake.state.status.groq = 200;
  
  // Tenta fazer uma chamada com fallback
  const ev = await collect(router.streamWithFallback([CLAUDE, GROQ], { messages: [{ role: 'user', content: 'oi' }] }));
  
  // Verifica que o primeiro evento indica o fallback
  assert.deepStrictEqual(ev[0], { type: 'model', provider: 'groq', model: GROQ.model, attempts: [{ provider: 'anthropic', model: 'claude-sonnet-4-6', code: CODES.UPSTREAM }] });
  
  // Verifica que a resposta final é do provedor subsequente
  assert.strictEqual(ev.filter(e => e.type === 'text').map(e => e.text).join(''), 'Olá, mundo!');
  
  // Verifica que não houve exceção
  assert.ok(true, 'Nenhuma exceção foi lançada');
});

test('fallback: múltiplos provedores com 429, último responde', async () => {
  // Configura múltiplos provedores para retornar 429, exceto o último
  fake.state.status.anthropic = 429;
  fake.state.status.groq = 429;
  fake.state.status.gemini = 200;
  
  // Tenta fazer uma chamada com múltiplos provedores
  const GEMINI = { provider: 'gemini', model: 'gemini-2.0-flash' };
  const ev = await collect(router.streamWithFallback([CLAUDE, GROQ, GEMINI], { messages: [{ role: 'user', content: 'oi' }] }));
  
  // Verifica que o primeiro evento indica o fallback para o último provedor
  assert.deepStrictEqual(ev[0], { type: 'model', provider: 'gemini', model: GEMINI.model, attempts: [
    { provider: 'anthropic', model: 'claude-sonnet-4-6', code: CODES.UPSTREAM },
    { provider: 'groq', model: 'llama-3.3-70b-versatile', code: CODES.UPSTREAM }
  ] });
  
  // Verifica que a resposta final é do último provedor
  assert.strictEqual(ev.filter(e => e.type === 'text').map(e => e.text).join(''), 'Olá, mundo!');
  
  // Verifica que não houve exceção
  assert.ok(true, 'Nenhuma exceção foi lançada');
});

test('fallback: todos provedores retornam 429, exceção esperada', async () => {
  // Configura todos os provedores para retornar 429
  fake.state.status.anthropic = 429;
  fake.state.status.groq = 429;
  fake.state.status.gemini = 429;
  
  const GEMINI = { provider: 'gemini', model: 'gemini-2.0-flash' };
  
  // Verifica que uma exceção é lançada quando todos falham
  await assert.rejects(
    collect(router.streamWithFallback([CLAUDE, GROQ, GEMINI], { messages: [{ role: 'user', content: 'oi' }] })),
    e => e.code === CODES.ALL_FAILED && e.details.attempts.length === 3
  );
});
