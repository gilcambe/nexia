'use strict';
// ADR-FREE-05: o Cortex nunca para de codar por falta de IA. Kilo Gateway sem chave no fim de toda
// lista, catálogo vivo de modelos ":free" (com lista fixa de reserva), troca de modelo rápida em 503 /
// teto por pedido, e WAITING_AI_QUOTA só depois de o Kilo também falhar. fetch falso: nenhuma API real.
const test = require('node:test');
const assert = require('node:assert');
const { createRouter, CODES } = require('../../nexia-ai/model-router');
const { pickFree, STATIC_FREE, MODELS_URL } = require('../../nexia-ai/model-router/providers/kilo-catalog');
const { runAgent, askModel, createMeter, classify } = require('../../nexia-ai/orchestrator/runtime');
const { candidates, FREE } = require('../../nexia-ai/orchestrator/models');

const KILO_CHAT = 'https://api.kilo.ai/api/gateway/chat/completions';
const CATALOG = { data: [
  { id: 'google/gemma-4-26b-a4b-it:free', supported_parameters: ['tools'] },
  { id: 'anthropic/claude-sonnet-5-5', supported_parameters: ['tools'], pricing: { prompt: '0.000003', completion: '0.000015' } },
  { id: 'qwen/qwen3-coder:free', supported_parameters: ['tools', 'temperature'] },
  { id: 'some/chat-only:free', supported_parameters: ['temperature'] },
  { id: 'meta/llama-9:free' },
  { id: 'minimax/minimax-m2.1:free', supported_parameters: ['tools'], pricing: { prompt: '0', completion: '0' } },
  { id: 'z-ai/glm-5:free', supported_parameters: ['tools'] },
  { id: 'sneaky/paid:free', pricing: { prompt: '0.000001', completion: '0' } },
] };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const answer = (model, text = 'feito') => json({ model, choices: [{ message: { content: text }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 2 } });

/** fetch falso: `route(url, body)` decide a resposta; guarda cada chamada (url, modelo, auth). */
function fakeFetch(route) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url: String(url), model: body && body.model, auth: init.headers && init.headers.Authorization });
    if (String(url) === MODELS_URL) return route.catalog ? route.catalog() : json(CATALOG);
    return route(String(url), body);
  };
  return { calls, fetchImpl };
}
const gateway = { describe: () => [{ name: 'github.get_file', risk: 'LOW', description: 'lê', input_schema: { type: 'object' } }], invoke: async () => ({ status: 'succeeded', result: {} }) };
const meter = () => createMeter({ max_steps: 100, max_tool_calls: 100, max_tokens: 1e9, max_ms: 60000 });
const run = (router, goal = 'Analise o pedido.') => runAgent({ agentId: 'architect', goal, router, gateway, ctx: {}, projectId: 'p1', meter: meter() });
const GROQ_DAY = 'Rate limit reached for model on requests per day (RPD): Limit 1000, Used 1000, Requested 1. Please try again in 1m26s.';

test('K1. Kilo funciona SEM chave (só modelos ":free"); com KILO_API_KEY manda a chave; modelo pago é recusado sem chamar', async () => {
  const { calls, fetchImpl } = fakeFetch((url, b) => (url === KILO_CHAT ? answer(b.model) : json({}, 404)));
  const r = createRouter({ env: {}, fetchImpl });
  assert.strictEqual(r.capabilities({ provider: 'kilo', model: 'auto:1' }).available, true, 'sem chave nenhuma, o Kilo está disponível');
  assert.strictEqual(r.capabilities({ provider: 'kilo', model: 'auto:1' }).tool_call, true);
  assert.deepStrictEqual([r.costEstimate({ provider: 'kilo', model: 'auto:1' }, { input_tokens: 1e6 }).known, r.costEstimate({ provider: 'kilo', model: 'auto:1' }, { input_tokens: 1e6 }).usd], [true, 0], 'custo zero conhecido');
  const out = await r.chat({ provider: 'kilo', model: 'auto:1' }, { messages: [{ role: 'user', content: 'oi' }] });
  assert.strictEqual(out.model, 'z-ai/glm-5:free');
  const chat = calls.filter(c => c.url === KILO_CHAT);
  assert.deepStrictEqual(chat.map(c => [c.model, c.auth]), [['z-ai/glm-5:free', undefined]], 'sem Authorization');

  const keyed = fakeFetch((url, b) => answer(b.model));
  const rk = createRouter({ env: { KILO_API_KEY: 'k-teste' }, fetchImpl: keyed.fetchImpl });
  await rk.chat({ provider: 'kilo', model: 'qwen/qwen3-coder:free' }, { messages: [{ role: 'user', content: 'oi' }] });
  assert.deepStrictEqual(keyed.calls.map(c => [c.url, c.model, c.auth]), [[KILO_CHAT, 'qwen/qwen3-coder:free', 'Bearer k-teste']]);
  const before = keyed.calls.length;
  await assert.rejects(rk.chat({ provider: 'kilo', model: 'anthropic/claude-sonnet-5-5' }, { messages: [{ role: 'user', content: 'oi' }] }), e => e.code === CODES.UNSUPPORTED);
  assert.strictEqual(keyed.calls.length, before, 'nada pago: nem chega a chamar');
});

test('K2. catálogo: só ":free" com ferramentas e preço zero, ordenado para código (Gemma por último); falha → lista fixa; cache', async () => {
  assert.deepStrictEqual(pickFree(CATALOG), ['z-ai/glm-5:free', 'minimax/minimax-m2.1:free', 'qwen/qwen3-coder:free', 'meta/llama-9:free', 'google/gemma-4-26b-a4b-it:free']);
  assert.deepStrictEqual(pickFree({ data: [] }), []);
  assert.deepStrictEqual(pickFree(null), []);

  const route = (url, b) => answer(b.model);
  route.catalog = () => { throw new Error('rede bloqueada'); };
  const f = fakeFetch(route);
  const r = createRouter({ env: {}, fetchImpl: f.fetchImpl });
  const got = [];
  for (const n of [1, 2, 3]) got.push((await r.chat({ provider: 'kilo', model: `auto:${n}` }, { messages: [{ role: 'user', content: 'oi' }] })).model);
  assert.deepStrictEqual(got, STATIC_FREE.slice(0, 3), 'consulta falhou: vale a lista fixa');
  assert.strictEqual(f.calls.filter(c => c.url === MODELS_URL).length, 1, 'uma consulta ao catálogo por processo (cache)');
  await assert.rejects(r.chat({ provider: 'kilo', model: 'auto:99' }, { messages: [{ role: 'user', content: 'oi' }] }), e => e.details.status === 404);

  const ok = fakeFetch((url, b) => answer(b.model));
  const r2 = createRouter({ env: {}, fetchImpl: ok.fetchImpl });
  await Promise.all([1, 2].map(n => r2.chat({ provider: 'kilo', model: `auto:${n}` }, { messages: [{ role: 'user', content: 'oi' }] })));
  assert.strictEqual(ok.calls.filter(c => c.url === MODELS_URL).length, 1, 'pedidos simultâneos dividem a mesma consulta');
});

test('K3. sem chave nenhuma o Cortex ainda tem candidatos (o Kilo) em toda classe; Cerebras fora (o "grátis" exige cartão)', () => {
  const r = createRouter({ env: {}, fetchImpl: async () => json({}) });
  for (const cls of ['reasoning', 'coding', 'fast']) {
    const c = candidates(r, cls, {});
    assert.ok(c.length >= 5 && c.every(d => d.provider === 'kilo'), cls);
    assert.ok(!FREE[cls].some(d => d.provider === 'cerebras'), cls);
  }
  // NVIDIA NIM e Codestral entram quando a chave existe (tool_call ligado).
  const k = createRouter({ env: { NVIDIA_API_KEY: 'n', CODESTRAL_API_KEY: 'c' }, fetchImpl: async () => json({}) });
  const provs = new Set(candidates(k, 'coding', {}).map(d => d.provider));
  assert.ok(provs.has('nvidia') && provs.has('codestral'));
});

test('K4. GitHub Models: pedido acima do teto por pedido (~8 mil tokens) é recusado sem chamar (TOO_LARGE); pedido pequeno passa', async () => {
  const f = fakeFetch((url, b) => answer(b.model));
  const r = createRouter({ env: { GITHUB_MODELS_TOKEN: 'gh' }, fetchImpl: f.fetchImpl });
  await assert.rejects(r.chat({ provider: 'github', model: 'openai/gpt-4.1' }, { messages: [{ role: 'user', content: 'x'.repeat(40000) }] }),
    e => e.code === CODES.TOO_LARGE && e.details.limit === 8000);
  assert.strictEqual(f.calls.length, 0);
  await r.chat({ provider: 'github', model: 'openai/gpt-4.1' }, { messages: [{ role: 'user', content: 'oi' }] });
  assert.strictEqual(f.calls.length, 1);
});

test('K5. classificação das falhas: 503 "high demand" e overloaded trocam na hora; teto por pedido pula; 413 por minuto encolhe', () => {
  const e = (status, upstream, code = 'UPSTREAM') => ({ code, details: { status, upstream } });
  assert.strictEqual(classify(e(503, '{"error":{"code":503,"message":"The model is overloaded due to high demand."}}')), 'busy');
  assert.strictEqual(classify(e(529, 'overloaded_error')), 'busy');
  assert.strictEqual(classify(e(413, '{"error":{"code":"tokens_limit_reached","message":"Request body too large for gpt-4.1 model. Max size: 8000 tokens."}}')), 'too_large');
  assert.strictEqual(classify({ code: 'TOO_LARGE', details: { status: 413 } }), 'too_large');
  assert.strictEqual(classify(e(413, 'Request too large for model on tokens per minute (TPM): Limit 8000')), 'tpm');
  assert.strictEqual(classify(e(429, 'Please try again in 7.5s')), 'rate');
  assert.strictEqual(classify(e(429, GROQ_DAY)), 'daily');
  assert.strictEqual(classify(e(404, 'model not found')), 'fatal');
  assert.strictEqual(classify({ code: 'UPSTREAM', details: {} }), 'transient');
});

test('K6. Groq sem cota do dia, GitHub grande demais e Gemini em 503 → o Kilo responde, sem esperar', async () => {
  const route = (url, b) => {
    if (url.includes('groq.com')) return json({ error: { message: GROQ_DAY } }, 429);
    if (url.includes('generativelanguage')) return json({ error: { code: 503, message: 'The model is overloaded due to high demand.' } }, 503);
    if (url === KILO_CHAT) return answer(b.model, 'A stack é Node.');
    return json({}, 404);
  };
  const f = fakeFetch(route);
  const r = createRouter({ env: { GROQ_API_KEY: 'g', GEMINI_API_KEY: 'k', GITHUB_MODELS_TOKEN: 'gh' }, fetchImpl: f.fetchImpl });
  const t0 = Date.now();
  const out = await run(r, `Analise o pedido.\n${'contexto '.repeat(4000)}`);
  assert.strictEqual(out.status, 'done', out.text);
  assert.strictEqual(out.model, 'kilo/z-ai/glm-5:free');
  assert.ok(Date.now() - t0 < 3000, 'nada de espera: cota do dia e 503 trocam de modelo na hora');
  const hosts = f.calls.filter(c => c.url !== MODELS_URL).map(c => new URL(c.url).hostname);
  assert.strictEqual(hosts.filter(h => h === 'api.groq.com').length, FREE.reasoning.filter(d => d.provider === 'groq').length, 'cada Groq uma vez (cota do dia: sem repetir)');
  assert.strictEqual(hosts.filter(h => h === 'generativelanguage.googleapis.com').length, 4, 'cada Gemini uma vez (503: sem repetir)');
  assert.ok(!hosts.includes('models.github.ai'), 'GitHub Models pulado sem chamada (pedido acima do teto)');
  assert.strictEqual(hosts.at(-1), 'api.kilo.ai');
});

test('K7. 429 no Kilo passa ao próximo modelo grátis do Kilo na hora; askModel segue as mesmas regras', async () => {
  let n = 0;
  const f = fakeFetch((url, b) => (url === KILO_CHAT && n++ === 0 ? json({ error: { message: 'Rate limit exceeded' } }, 429) : answer(b.model)));
  const r = createRouter({ env: {}, fetchImpl: f.fetchImpl });
  const t0 = Date.now();
  const out = await run(r);
  assert.strictEqual(out.status, 'done');
  assert.strictEqual(out.model, 'kilo/minimax/minimax-m2.1:free');
  assert.ok(Date.now() - t0 < 3000);
  const g = fakeFetch((url, b) => (url.includes('generativelanguage') ? json({}, 503) : answer(b.model, '{"ok":true}')));
  const a = await askModel({ agentId: 'architect', router: createRouter({ env: { GEMINI_API_KEY: 'k' }, fetchImpl: g.fetchImpl }), meter: meter(), system: 's', prompt: 'p' });
  assert.deepStrictEqual([a.status, a.model], ['done', 'kilo/z-ai/glm-5:free']);
});

test('K8. WAITING_AI_QUOTA só quando TUDO falha, inclusive os 5 modelos do Kilo', async () => {
  const f = fakeFetch(() => json({ error: { message: 'high demand' } }, 503));
  const r = createRouter({ env: { GROQ_API_KEY: 'g', GEMINI_API_KEY: 'k' }, fetchImpl: f.fetchImpl });
  const out = await run(r);
  assert.strictEqual(out.status, 'failed');
  assert.strictEqual(out.error_code, 'MODEL_UPSTREAM', 'código que o Orchestrator transforma em WAITING_AI_QUOTA (ADR-FREE-04)');
  const kilo = f.calls.filter(c => c.url === KILO_CHAT);
  assert.strictEqual(kilo.length, 5, 'os 5 do Kilo foram tentados antes de desistir');
  assert.strictEqual(f.calls.at(-1).url, KILO_CHAT, 'o Kilo é o último');
  assert.match(out.text, /kilo\/auto:5/);
});
