'use strict';
// Adapter para os provedores com API compatível com OpenAI Chat Completions
// (os mesmos endpoints que cortex-chat e multi-model-engine já usavam).
const { ModelError, CODES } = require('../errors');
const { withTimeout, sseData } = require('../messages');
const { createKiloCatalog, isFree } = require('./kilo-catalog');

// max_output: teto aplicado ao max_tokens pedido. Os chamadores legados pediam até
// 100000 tokens, e vários provedores recusam com 400 acima do próprio limite.
// TEMPORÁRIO: tetos conservadores por provedor (não por modelo). Risco: cortar uma
// resposta longa num modelo que aceitaria mais. Remoção: catálogo com limites por
// modelo vindos do provedor (Fase 11).
// keyless: funciona sem chave (a chave em `env` é opcional). max_input: teto de tokens de ENTRADA por pedido;
// pedido maior é recusado aqui (TOO_LARGE), sem gastar chamada, e o Cortex passa para o próximo modelo.
const PROVIDERS = Object.freeze({
  // Plano grátis do Google AI Studio (ADR-FREE-03): mesma chave GEMINI_API_KEY, endpoint compatível com OpenAI e com tool_call.
  google:      { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', env: 'GEMINI_API_KEY', max_output: 65536, tools: true, vision: true },
  openai:      { url: 'https://api.openai.com/v1/chat/completions', env: 'OPENAI_API_KEY', max_output: 16384, usage_option: true, tools: true },
  groq:        { url: 'https://api.groq.com/openai/v1/chat/completions', env: 'GROQ_API_KEY', max_output: 32768, tools: true },
  deepseek:    { url: 'https://api.deepseek.com/v1/chat/completions', env: 'DEEPSEEK_API_KEY', max_output: 8192, tools: true },
  xai:         { url: 'https://api.x.ai/v1/chat/completions', env: 'XAI_API_KEY', max_output: 32768, tools: true },
  perplexity:  { url: 'https://api.perplexity.ai/chat/completions', env: 'PERPLEXITY_API_KEY', max_output: 8192, tools: false },
  cerebras:    { url: 'https://api.cerebras.ai/v1/chat/completions', env: 'CEREBRAS_API_KEY', max_output: 32768, tools: true },
  openrouter:  { url: 'https://openrouter.ai/api/v1/chat/completions', env: 'OPENROUTER_API_KEY', max_output: 16384, tools: true,
                 extraHeaders: env => ({ 'HTTP-Referer': env.NEXIA_APP_URL || 'https://nexia.com.br', 'X-Title': 'NEXIA OS' }) },
  mistral:     { url: 'https://api.mistral.ai/v1/chat/completions', env: 'MISTRAL_API_KEY', max_output: 32768, tools: true },
  // ADR-FREE-05: NVIDIA NIM (build.nvidia.com, grátis com verificação por telefone, 40 pedidos/min) aceita tool_call no formato OpenAI.
  nvidia:      { url: 'https://integrate.api.nvidia.com/v1/chat/completions', env: 'NVIDIA_API_KEY', max_output: 4096, tools: true },
  huggingface: { url: m => `https://router.huggingface.co/hf-inference/models/${m}/v1/chat/completions`, env: 'HF_API_KEY', max_output: 8192, tools: false },
  sambanova:   { url: 'https://api.sambanova.ai/v1/chat/completions', env: 'SAMBANOVA_API_KEY', max_output: 8192, tools: false },
  together:    { url: 'https://api.together.xyz/v1/chat/completions', env: 'TOGETHER_API_KEY', max_output: 8192, tools: true },
  // ADR-FREE-04: grátis e sem cadastro novo. GitHub Models usa o próprio token do GitHub Actions
  // (permissão models: read); Workers AI usa a conta grátis do Cloudflare (10 mil "neurons" por dia).
  // Plano grátis do GitHub Models: ~8 mil tokens de entrada por pedido (acima disso, 413 tokens_limit_reached).
  github:      { url: 'https://models.github.ai/inference/chat/completions', env: 'GITHUB_MODELS_TOKEN', max_output: 4096, max_input: 8000, tools: true },
  cloudflare:  { url: (m, env) => `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_AI_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID || 'sem-conta')}/ai/v1/chat/completions`,
                 env: 'CLOUDFLARE_AI_TOKEN', max_output: 8192, tools: true },   // + CLOUDFLARE_AI_ACCOUNT_ID
  // ADR-FREE-05: Codestral (codestral.mistral.ai) tem chave própria e grátis (30 pedidos/min, 2 mil por dia).
  codestral:   { url: 'https://codestral.mistral.ai/v1/chat/completions', env: 'CODESTRAL_API_KEY', max_output: 32768, tools: true },
  // ADR-FREE-05: Kilo Gateway. Sem chave, só modelos grátis (":free"; 200 pedidos/hora por IP). KILO_API_KEY é opcional.
  // O modelo "auto:N" é o N-ésimo grátis do catálogo vivo do gateway (kilo-catalog.js); nunca chama modelo pago.
  kilo:        { url: 'https://api.kilo.ai/api/gateway/chat/completions', env: 'KILO_API_KEY', keyless: true, free_only: true, catalog: true, max_output: 16384, tools: true },
});

const DEFAULT_TIMEOUT = 120000;

const AUTO = /^auto:(\d{1,2})$/;
/** Estimativa conservadora de tokens de entrada (~3,5 caracteres por token em português e código). */
function estimateInputTokens(b) {
  const chars = JSON.stringify(b.messages || []).length + (b.tools ? JSON.stringify(b.tools).length : 0);
  return Math.ceil(chars / 3.5);
}

function createOpenAICompatibleProvider(id, { env = process.env, fetchImpl = (...a) => fetch(...a), baseUrl } = {}) {
  const cfg = PROVIDERS[id];
  if (!cfg) throw new ModelError(CODES.UNKNOWN_PROVIDER, `Provedor desconhecido: ${id}`);
  const urlFor = model => baseUrl || (typeof cfg.url === 'function' ? cfg.url(model, env) : cfg.url);
  const catalog = cfg.catalog ? createKiloCatalog({ fetchImpl, env }) : null;

  /** "auto:N" → N-ésimo modelo grátis do catálogo; nome explícito passa direto (com a trava de ":free"). */
  async function resolveModel(model) {
    const m = catalog && AUTO.exec(model);
    let real = model;
    if (m) {
      const { ids } = await catalog.list();
      real = ids[Number(m[1]) - 1];
      if (!real) throw new ModelError(CODES.UPSTREAM, `${id}: catálogo grátis sem o modelo ${model}`, { provider: id, status: 404, model });
    }
    if (cfg.free_only && !isFree(real)) throw new ModelError(CODES.UNSUPPORTED, `${id}: só modelos grátis (":free").`, { provider: id, model: real });
    return real;
  }

  const capabilities = () => ({ chat: true, streaming: true, tool_call: !!cfg.tools, structured_output: true, vision: !!cfg.vision, max_output_tokens: cfg.max_output });

  // Imagens (req.images = [{ mime, data(base64) }]) vão na última mensagem do usuário, no formato image_url.
  function withImages(messages, images) {
    if (!cfg.vision || !Array.isArray(images) || !images.length) return messages;
    const i = messages.map(m => m.role).lastIndexOf('user');
    if (i < 0) return messages;
    const parts = [{ type: 'text', text: messages[i].content }, ...images.map(im => ({ type: 'image_url', image_url: { url: `data:${im.mime};base64,${im.data}` } }))];
    return messages.map((m, k) => (k === i ? { ...m, content: parts } : m));
  }

  function body(model, req, stream) {
    const b = {
      model,
      max_tokens: Math.min(req.maxTokens || 4096, cfg.max_output),
      messages: [...(req.system ? [{ role: 'system', content: req.system }] : []), ...withImages(req.messages, req.images)],
    };
    if (req.temperature !== undefined) b.temperature = req.temperature;
    if (stream) { b.stream = true; if (cfg.usage_option) b.stream_options = { include_usage: true }; }
    if (req.tools && req.tools.length) {
      if (!cfg.tools) throw new ModelError(CODES.UNSUPPORTED, `${id} não suporta tool_call neste adapter.`, { provider: id });
      b.tools = req.tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description || '', parameters: t.input_schema } }));
      if (req.toolChoice) b.tool_choice = req.toolChoice === 'any' ? 'required' : { type: 'function', function: { name: req.toolChoice } };
    }
    return b;
  }

  async function post(asked, req, stream) {
    const key = env[cfg.env];
    if (!key && !cfg.keyless) throw new ModelError(CODES.NO_API_KEY, `${cfg.env} não configurada.`, { provider: id, env: cfg.env });
    const model = await resolveModel(asked);
    const b = body(model, req, stream);
    if (cfg.max_input) {
      const est = estimateInputTokens(b);
      if (est > cfg.max_input) throw new ModelError(CODES.TOO_LARGE, `${id}: pedido de ~${est} tokens passa do teto de ${cfg.max_input} por pedido`, { provider: id, model, status: 413, estimated: est, limit: cfg.max_input });
    }
    const t = withTimeout(req.signal, req.timeoutMs || DEFAULT_TIMEOUT);
    let res;
    try {
      res = await fetchImpl(urlFor(model), {
        method: 'POST',
        headers: { ...(key ? { Authorization: `Bearer ${key}` } : {}), 'Content-Type': 'application/json', ...(cfg.extraHeaders ? cfg.extraHeaders(env) : {}) },
        body: JSON.stringify(b),
        signal: t.signal,
      });
    } catch (e) {
      t.done();
      if (e instanceof ModelError) throw e;
      if (t.signal.aborted) throw new ModelError(CODES.ABORTED, `Chamada a ${id} cancelada ou expirada.`, { provider: id });
      throw new ModelError(CODES.UPSTREAM, `${id} erro de rede`, { provider: id });
    }
    if (!res.ok) {
      const snippet = (await res.text().catch(() => '')).slice(0, 300);
      t.done();
      throw new ModelError(CODES.UPSTREAM, `${id} ${res.status}`, { provider: id, model, status: res.status, upstream: snippet });
    }
    return { res, t, model };
  }

  const usageOf = u => ({ input_tokens: (u && (u.prompt_tokens ?? u.input_tokens)) || 0, output_tokens: (u && (u.completion_tokens ?? u.output_tokens)) || 0 });

  return {
    id,
    envKey: cfg.env,
    available: () => !!cfg.keyless || !!env[cfg.env],
    capabilities,

    async chat(model, req) {
      const { res, t, model: real } = await post(model, req, false);
      try {
        const d = await res.json();
        const msg = (d.choices && d.choices[0] && d.choices[0].message) || {};
        const tool_calls = (msg.tool_calls || []).map(tc => {
          let input = {};
          try { input = JSON.parse(tc.function.arguments || '{}'); } catch { input = { _raw: String(tc.function.arguments || '') }; }
          return { id: tc.id, name: tc.function.name, input };
        });
        return { provider: id, model: d.model || real, text: msg.content || '', tool_calls, usage: usageOf(d.usage), stop_reason: (d.choices && d.choices[0] && d.choices[0].finish_reason) || null };
      } catch (e) {
        throw new ModelError(CODES.UPSTREAM, `${id} resposta inválida`, { provider: id });
      } finally { t.done(); }
    },

    async *stream(model, req) {
      const { res, t } = await post(model, req, true);
      let usage = { input_tokens: 0, output_tokens: 0 };
      let stop = null;
      try {
        for await (const data of sseData(res.body)) {
          if (!data || data === '[DONE]') continue;
          let p;
          try { p = JSON.parse(data); } catch { continue; }
          if (p.usage) usage = usageOf(p.usage);
          const ch = p.choices && p.choices[0];
          if (ch && ch.finish_reason) stop = ch.finish_reason;
          const txt = ch && ch.delta && ch.delta.content;
          if (txt) yield { type: 'text', text: txt };
        }
        yield { type: 'done', usage, stop_reason: stop, tool_calls: [] };
      } catch (e) {
        if (e instanceof ModelError) throw e;
        if (t.signal.aborted) throw new ModelError(CODES.ABORTED, `Stream de ${id} cancelado ou expirado.`, { provider: id });
        throw new ModelError(CODES.UPSTREAM, `${id} stream interrompido`, { provider: id });
      } finally {
        t.done();
        try { await res.body.cancel(); } catch { /* já consumido */ }
      }
    },
  };
}

module.exports = { createOpenAICompatibleProvider, PROVIDERS, estimateInputTokens };
