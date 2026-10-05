'use strict';
// Fase 5: Model Router. Adapters reais (SDK oficial no Claude) contra um servidor falso
// que fala o protocolo de cada provedor. Nenhuma chave real, nenhuma rede externa.
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
const GEMINI = { provider: 'gemini', model: 'gemini-2.0-flash' };
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

test('M1. resumos da memória (role system no histórico) viram system prompt em vez de sumir', () => {
  const r = normalizeRequest({ system: 'Você é o CORTEX.', messages: [
    { role: 'system', content: 'MEMÓRIA COMPRIMIDA (contexto anterior do usuário):\n[Resumo 1]: cliente prefere Pix' },
    { role: 'user', content: 'oi' }, { role: 'assistant', content: '' }, { role: 'user', content: [{ type: 'text', text: 'tudo bem?' }] },
  ] });
  assert.strictEqual(r.system, 'Você é o CORTEX.\n\nMEMÓRIA COMPRIMIDA (contexto anterior do usuário):\n[Resumo 1]: cliente prefere Pix');
  assert.deepStrictEqual(r.messages, [{ role: 'user', content: 'oi' }, { role: 'user', content: 'tudo bem?' }]);
});

test('M2. Claude via SDK oficial: chat com resumo no system, max_tokens limitado ao teto do modelo, uso e custo', async () => {
  const out = await router.chat(CLAUDE, { system: 'S', maxTokens: 100000, messages: [{ role: 'system', content: 'MEMÓRIA COMPRIMIDA: resumo X' }, { role: 'user', content: 'oi' }] });
  assert.strictEqual(out.text, 'Olá, mundo!');
  assert.strictEqual(out.provider, 'anthropic');
  assert.deepStrictEqual(out.usage, { input_tokens: 12, output_tokens: 5 });
  const req = last();
  assert.strictEqual(req.path, '/v1/messages');
  assert.strictEqual(req.body.system, 'S\n\nMEMÓRIA COMPRIMIDA: resumo X');
  assert.strictEqual(req.body.max_tokens, 64000);
  assert.ok(req.headers['x-api-key'], 'SDK envia x-api-key');
  assert.match(req.headers['user-agent'] || '', /Anthropic\/JS/);
  const cost = router.costEstimate(CLAUDE, out.usage);
  assert.deepStrictEqual([cost.known, cost.usd], [true, (12 * 3 + 5 * 15) / 1e6]);
  assert.strictEqual(router.costEstimate(GROQ, out.usage).known, false);
});

test('M3. streaming real no Claude: o primeiro token chega antes de o provedor terminar', async () => {
  let release;
  fake.state.gate = new Promise(r => { release = r; });
  const it = router.stream(CLAUDE, { messages: [{ role: 'user', content: 'oi' }] })[Symbol.asyncIterator]();
  const first = await it.next();
  assert.deepStrictEqual(first.value, { type: 'text', text: 'Olá' });
  // o provedor ainda está segurando o resto da resposta
  release();
  const rest = [];
  for (let n = await it.next(); !n.done; n = await it.next()) rest.push(n.value);
  assert.deepStrictEqual(rest.filter(e => e.type === 'text').map(e => e.text), [', mundo', '!']);
  const done = rest.find(e => e.type === 'done');
  assert.deepStrictEqual([done.stop_reason, done.usage.output_tokens], ['end_turn', 5]);
  assert.strictEqual(last().body.stream, true);
});

test('M4. OpenAI-compatível (Groq): streaming com uso, chat, teto de max_tokens e tool_call', async () => {
  const ev = await collect(router.stream(GROQ, { system: 'S', maxTokens: 100000, messages: [{ role: 'user', content: 'oi' }] }));
  assert.deepStrictEqual(ev.filter(e => e.type === 'text').map(e => e.text), ['Olá', ', mundo', '!']);
  assert.deepStrictEqual(ev.at(-1).usage, { input_tokens: 3, output_tokens: 2 });
  assert.strictEqual(last().body.max_tokens, 32768);
  assert.deepStrictEqual(last().body.messages[0], { role: 'system', content: 'S' });
  assert.strictEqual(last().headers.authorization, `Bearer ${ENV.GROQ_API_KEY}`);
  fake.state.toolInput = { cidade: 'Recife' };
  const tc = await router.toolCall(GROQ, { messages: [{ role: 'user', content: 'clima' }], tools: [{ name: 'clima', input_schema: { type: 'object' } }] });
  assert.deepStrictEqual(tc.tool_calls, [{ id: 'call_1', name: 'clima', input: { cidade: 'Recife' } }]);
  assert.strictEqual(last().body.tools[0].function.name, 'clima');
});

test('M5. Gemini: streaming com a chave no header (nunca na URL)', async () => {
  const ev = await collect(router.stream(GEMINI, { system: 'S', messages: [{ role: 'user', content: 'oi' }] }));
  assert.deepStrictEqual(ev.filter(e => e.type === 'text').map(e => e.text), ['Olá', ', mundo', '!']);
  const req = last();
  assert.match(req.path, /^\/gemini\/gemini-2\.0-flash:streamGenerateContent\?alt=sse$/);
  assert.ok(!req.path.includes('key='));
  assert.strictEqual(req.headers['x-goog-api-key'], ENV.GEMINI_API_KEY);
  assert.deepStrictEqual(req.body.systemInstruction, { parts: [{ text: 'S' }] });
});

test('M6. chave ausente falha antes de qualquer chamada de rede', async () => {
  let called = 0;
  const r = createRouter({ env: {}, fetchImpl: async () => { called++; throw new Error('não deveria chamar'); } });
  for (const d of [CLAUDE, GROQ, GEMINI, { provider: 'cohere', model: 'command-r' }]) {
    await assert.rejects(r.chat(d, { messages: [{ role: 'user', content: 'oi' }] }), e => e.code === CODES.NO_API_KEY);
    assert.strictEqual(r.capabilities(d).available, false);
  }
  assert.strictEqual(called, 0);
  await assert.rejects(r.chat({ provider: 'inexistente', model: 'x' }, {}), e => e.code === CODES.UNKNOWN_PROVIDER);
});

test('M7. fallback: troca de provedor antes do primeiro token; erro depois do primeiro token não troca', async () => {
  fake.state.status.anthropic = 500;
  const ev = await collect(router.streamWithFallback([CLAUDE, { provider: 'anthropic', model: 'claude-sonnet-4-6' }, GROQ], { messages: [{ role: 'user', content: 'oi' }] }));
  assert.deepStrictEqual(ev[0], { type: 'model', provider: 'groq', model: GROQ.model, attempts: [{ provider: 'anthropic', model: 'claude-sonnet-4-6', code: CODES.UPSTREAM }] });
  assert.strictEqual(ev.filter(e => e.type === 'text').map(e => e.text).join(''), 'Olá, mundo!');

  fake.state.status = {};
  fake.state.failMidStream = true;
  const ev2 = await collect(router.streamWithFallback([GROQ, GEMINI], { messages: [{ role: 'user', content: 'oi' }] }));
  assert.deepStrictEqual(ev2.map(e => e.type), ['model', 'text', 'error']);
  assert.strictEqual(ev2[0].provider, 'groq');

  fake.state.failMidStream = false;
  fake.state.status = { anthropic: 500, openai: 500, gemini: 500 };
  await assert.rejects(collect(router.streamWithFallback([CLAUDE, GROQ, GEMINI], { messages: [{ role: 'user', content: 'oi' }] })), e => e.code === CODES.ALL_FAILED && e.details.attempts.length === 3);
  const c = await createRouter({ env: { GEMINI_API_KEY: 'k' }, baseUrls: fake.baseUrls() }).chatWithFallback([CLAUDE, GROQ], { messages: [{ role: 'user', content: 'oi' }] }).catch(e => e);
  assert.deepStrictEqual(c.details.attempts.map(a => a.code), [CODES.NO_API_KEY, CODES.NO_API_KEY]);
});

test('M8. saída estruturada: tool forçada no Claude, JSON validado no Gemini, inválida vira INVALID_OUTPUT', async () => {
  const schema = { type: 'object', required: ['projeto', 'confianca'], properties: { projeto: { type: 'string' }, confianca: { type: 'number' } } };
  fake.state.toolInput = { projeto: 'CES Check-in', confianca: 0.9 };
  const a = await router.structuredOutput(CLAUDE, { messages: [{ role: 'user', content: 'qual projeto?' }] }, schema);
  assert.deepStrictEqual(a.data, { projeto: 'CES Check-in', confianca: 0.9 });
  assert.deepStrictEqual(last().body.tool_choice, { type: 'tool', name: 'resposta' });

  fake.state.text = ['```json\n{"projeto":"NEXIA OS",', '"confianca":1}\n```'];
  const g = await router.structuredOutput(GEMINI, { messages: [{ role: 'user', content: 'qual projeto?' }] }, schema);
  assert.deepStrictEqual(g.data, { projeto: 'NEXIA OS', confianca: 1 });

  fake.state.toolInput = { projeto: 7 };
  await assert.rejects(router.structuredOutput(CLAUDE, { messages: [{ role: 'user', content: 'x' }] }, schema),
    e => e.code === CODES.INVALID_OUTPUT && e.details.problems.includes('$.projeto: esperado string') && e.details.problems.includes('$.confianca: obrigatório'));
  assert.deepStrictEqual(validate({ type: 'array', items: { enum: ['a', 'b'] } }, ['a', 'c']), ['$[1]: fora de enum']);
});

test('M9. catálogos: todo modelo do cortex-chat e do multi-model-engine tem provedor no router (nenhum removido)', () => {
  const { AI_CATALOG } = require('../../netlify/functions/cortex-chat');
  const { MODELS } = require('../../netlify/functions/multi-model-engine');
  const entries = [...Object.entries(AI_CATALOG).map(([k, m]) => [`cortex:${k}`, m.provider, m.model]), ...Object.entries(MODELS).map(([k, m]) => [`mme:${k}`, m.provider, m.id])];
  const missing = entries.filter(([, p]) => !PROVIDER_IDS.includes(p));
  assert.deepStrictEqual(missing, []);
  // contagem igual à de antes da Fase 5 (develop em e44d09d): 52 no cortex-chat, 13 no multi-model-engine
  assert.deepStrictEqual([Object.keys(AI_CATALOG).length, Object.keys(MODELS).length], [52, 13]);
  for (const [, provider, model] of entries) {
    const c = router.capabilities({ provider, model });
    assert.ok(c.chat && c.max_output_tokens > 0, `${provider}/${model}`);
  }
});

test('M10. server.js: resposta { stream } sai em trechos e o iterador é encerrado se o cliente desconectar', async () => {
  let release;
  const gate = new Promise(r => { release = r; });
  let returned = false;
  async function* gen() {
    try { yield 'data: 1\n\n'; await gate; yield 'data: 2\n\n'; } finally { returned = true; }
  }
  const srv = http.createServer((req, res) => writeStream(req, res, { statusCode: 200, headers: { 'Content-Type': 'text/event-stream' }, stream: gen() }));
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const first = await new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: srv.address().port, path: '/' }, res => {
      assert.strictEqual(res.headers['x-accel-buffering'], 'no');
      res.once('data', c => { resolve(c.toString()); req.destroy(); });
    });
    req.on('error', e => { if (e.code !== 'ECONNRESET') reject(e); });
  });
  assert.strictEqual(first, 'data: 1\n\n');
  for (let i = 0; i < 50 && !returned; i++) await new Promise(r => setTimeout(r, 10));
  release();
  for (let i = 0; i < 50 && !returned; i++) await new Promise(r => setTimeout(r, 10));
  assert.strictEqual(returned, true);
  await new Promise(r => srv.close(r));
});

test('M11. cortex-chat só tenta IAs com chave: só GEMINI_API_KEY → Gemini primeiro, mesmo pedindo Groq', () => {
  const { chain } = require('../../netlify/functions/cortex-chat');
  const keys = ['GEMINI_API_KEY', 'GROQ_API_KEY', 'DEEPSEEK_API_KEY', 'CEREBRAS_API_KEY', 'OPENROUTER_API_KEY', 'MISTRAL_API_KEY', 'ANTHROPIC_API_KEY'];
  const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  try {
    for (const k of keys) delete process.env[k];
    assert.deepStrictEqual(chain('groq_llama4_scout'), []);
    process.env.GEMINI_API_KEY = 'x';
    assert.deepStrictEqual(chain('groq_llama4_scout', 'deepseek_v3').slice(0, 2), ['gemini_25_flash', 'gemini_25_pro']);
    process.env.GROQ_API_KEY = 'y';
    assert.strictEqual(chain('groq_llama4_scout')[0], 'groq_llama4_scout');
  } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});

test('M12. ADR-FREE-04: GitHub Models (token do Actions) e Workers AI (conta grátis) usam o endpoint certo; sem chave, ficam de fora', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, auth: init.headers.Authorization }); return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'oi' } }], usage: {} }) }; };
  const env = { GITHUB_MODELS_TOKEN: 'gh-t', CLOUDFLARE_AI_TOKEN: 'cf-t', CLOUDFLARE_AI_ACCOUNT_ID: 'abc123' };
  const r = createRouter({ env, fetchImpl });
  await r.chat({ provider: 'github', model: 'openai/gpt-4.1' }, { messages: [{ role: 'user', content: 'oi' }] });
  await r.chat({ provider: 'cloudflare', model: '@cf/openai/gpt-oss-120b' }, { messages: [{ role: 'user', content: 'oi' }] });
  assert.deepStrictEqual(calls.map(c => c.url), ['https://models.github.ai/inference/chat/completions', 'https://api.cloudflare.com/client/v4/accounts/abc123/ai/v1/chat/completions']);
  assert.deepStrictEqual(calls.map(c => c.auth), ['Bearer gh-t', 'Bearer cf-t']);
  const none = createRouter({ env: {}, fetchImpl });
  assert.strictEqual(none.capabilities({ provider: 'github', model: 'openai/gpt-4.1' }).available, false);
});
