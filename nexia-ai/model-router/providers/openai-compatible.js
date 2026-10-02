'use strict';
// Adapter para os provedores com API compatível com OpenAI Chat Completions
// (os mesmos endpoints que cortex-chat e multi-model-engine já usavam).
const { ModelError, CODES } = require('../errors');
const { withTimeout, sseData } = require('../messages');

// max_output: teto aplicado ao max_tokens pedido. Os chamadores legados pediam até
// 100000 tokens, e vários provedores recusam com 400 acima do próprio limite.
// TEMPORÁRIO: tetos conservadores por provedor (não por modelo). Risco: cortar uma
// resposta longa num modelo que aceitaria mais. Remoção: catálogo com limites por
// modelo vindos do provedor (Fase 11).
const PROVIDERS = Object.freeze({
  openai:      { url: 'https://api.openai.com/v1/chat/completions', env: 'OPENAI_API_KEY', max_output: 16384, usage_option: true, tools: true },
  groq:        { url: 'https://api.groq.com/openai/v1/chat/completions', env: 'GROQ_API_KEY', max_output: 32768, tools: true },
  deepseek:    { url: 'https://api.deepseek.com/v1/chat/completions', env: 'DEEPSEEK_API_KEY', max_output: 8192, tools: true },
  xai:         { url: 'https://api.x.ai/v1/chat/completions', env: 'XAI_API_KEY', max_output: 32768, tools: true },
  perplexity:  { url: 'https://api.perplexity.ai/chat/completions', env: 'PERPLEXITY_API_KEY', max_output: 8192, tools: false },
  cerebras:    { url: 'https://api.cerebras.ai/v1/chat/completions', env: 'CEREBRAS_API_KEY', max_output: 32768, tools: true },
  openrouter:  { url: 'https://openrouter.ai/api/v1/chat/completions', env: 'OPENROUTER_API_KEY', max_output: 16384, tools: true,
                 extraHeaders: env => ({ 'HTTP-Referer': env.NEXIA_APP_URL || 'https://nexia.com.br', 'X-Title': 'NEXIA OS' }) },
  mistral:     { url: 'https://api.mistral.ai/v1/chat/completions', env: 'MISTRAL_API_KEY', max_output: 32768, tools: true },
  nvidia:      { url: 'https://integrate.api.nvidia.com/v1/chat/completions', env: 'NVIDIA_API_KEY', max_output: 4096, tools: false },
  huggingface: { url: m => `https://router.huggingface.co/hf-inference/models/${m}/v1/chat/completions`, env: 'HF_API_KEY', max_output: 8192, tools: false },
  sambanova:   { url: 'https://api.sambanova.ai/v1/chat/completions', env: 'SAMBANOVA_API_KEY', max_output: 8192, tools: false },
  together:    { url: 'https://api.together.xyz/v1/chat/completions', env: 'TOGETHER_API_KEY', max_output: 8192, tools: true },
});

const DEFAULT_TIMEOUT = 120000;

function createOpenAICompatibleProvider(id, { env = process.env, fetchImpl = (...a) => fetch(...a), baseUrl } = {}) {
  const cfg = PROVIDERS[id];
  if (!cfg) throw new ModelError(CODES.UNKNOWN_PROVIDER, `Provedor desconhecido: ${id}`);
  const urlFor = model => baseUrl || (typeof cfg.url === 'function' ? cfg.url(model) : cfg.url);

  const capabilities = () => ({ chat: true, streaming: true, tool_call: !!cfg.tools, structured_output: true, max_output_tokens: cfg.max_output });

  function body(model, req, stream) {
    const b = {
      model,
      max_tokens: Math.min(req.maxTokens || 4096, cfg.max_output),
      messages: [...(req.system ? [{ role: 'system', content: req.system }] : []), ...req.messages],
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

  async function post(model, req, stream) {
    const key = env[cfg.env];
    if (!key) throw new ModelError(CODES.NO_API_KEY, `${cfg.env} não configurada.`, { provider: id, env: cfg.env });
    const t = withTimeout(req.signal, req.timeoutMs || DEFAULT_TIMEOUT);
    let res;
    try {
      res = await fetchImpl(urlFor(model), {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(cfg.extraHeaders ? cfg.extraHeaders(env) : {}) },
        body: JSON.stringify(body(model, req, stream)),
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
      throw new ModelError(CODES.UPSTREAM, `${id} ${res.status}`, { provider: id, status: res.status, upstream: snippet });
    }
    return { res, t };
  }

  const usageOf = u => ({ input_tokens: (u && (u.prompt_tokens ?? u.input_tokens)) || 0, output_tokens: (u && (u.completion_tokens ?? u.output_tokens)) || 0 });

  return {
    id,
    envKey: cfg.env,
    available: () => !!env[cfg.env],
    capabilities,

    async chat(model, req) {
      const { res, t } = await post(model, req, false);
      try {
        const d = await res.json();
        const msg = (d.choices && d.choices[0] && d.choices[0].message) || {};
        const tool_calls = (msg.tool_calls || []).map(tc => {
          let input = {};
          try { input = JSON.parse(tc.function.arguments || '{}'); } catch { input = { _raw: String(tc.function.arguments || '') }; }
          return { id: tc.id, name: tc.function.name, input };
        });
        return { provider: id, model: d.model || model, text: msg.content || '', tool_calls, usage: usageOf(d.usage), stop_reason: (d.choices && d.choices[0] && d.choices[0].finish_reason) || null };
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

module.exports = { createOpenAICompatibleProvider, PROVIDERS };
