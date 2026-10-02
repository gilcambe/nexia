'use strict';
// Adapter Gemini (Generative Language API). A chave vai no header x-goog-api-key,
// não na URL (o código legado punha ?key= na URL, que acaba em logs de proxy).
const { ModelError, CODES } = require('../errors');
const { withTimeout, sseData } = require('../messages');

const ENV_KEY = 'GEMINI_API_KEY';
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_TIMEOUT = 120000;
const maxOutput = model => (/^gemini-2\.5/.test(model) ? 65536 : 8192);

function createGeminiProvider({ env = process.env, fetchImpl = (...a) => fetch(...a), baseUrl = BASE } = {}) {
  const capabilities = model => ({ chat: true, streaming: true, tool_call: false, structured_output: true, max_output_tokens: maxOutput(model) });

  function body(model, req) {
    if (req.tools && req.tools.length) throw new ModelError(CODES.UNSUPPORTED, 'gemini não suporta tool_call neste adapter.', { provider: 'gemini' });
    const b = {
      contents: req.messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: Math.min(req.maxTokens || 4096, maxOutput(model)) },
    };
    if (req.temperature !== undefined) b.generationConfig.temperature = req.temperature;
    if (req.system) b.systemInstruction = { parts: [{ text: req.system }] };
    return b;
  }

  async function post(model, req, stream) {
    const key = env[ENV_KEY];
    if (!key) throw new ModelError(CODES.NO_API_KEY, `${ENV_KEY} não configurada.`, { provider: 'gemini', env: ENV_KEY });
    const url = `${baseUrl}/${encodeURIComponent(model)}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`;
    const t = withTimeout(req.signal, req.timeoutMs || DEFAULT_TIMEOUT);
    let res;
    try {
      res = await fetchImpl(url, { method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body(model, req)), signal: t.signal });
    } catch (e) {
      t.done();
      if (e instanceof ModelError) throw e;
      if (t.signal.aborted) throw new ModelError(CODES.ABORTED, 'Chamada ao Gemini cancelada ou expirada.', { provider: 'gemini' });
      throw new ModelError(CODES.UPSTREAM, 'gemini erro de rede', { provider: 'gemini' });
    }
    if (!res.ok) {
      const snippet = (await res.text().catch(() => '')).slice(0, 300);
      t.done();
      throw new ModelError(CODES.UPSTREAM, `gemini ${res.status}`, { provider: 'gemini', status: res.status, upstream: snippet });
    }
    return { res, t };
  }

  const textOf = d => ((d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || []).map(p => p.text || '').join('');
  const usageOf = d => ({ input_tokens: (d.usageMetadata && d.usageMetadata.promptTokenCount) || 0, output_tokens: (d.usageMetadata && d.usageMetadata.candidatesTokenCount) || 0 });

  return {
    id: 'gemini',
    envKey: ENV_KEY,
    available: () => !!env[ENV_KEY],
    capabilities,

    async chat(model, req) {
      const { res, t } = await post(model, req, false);
      try {
        const d = await res.json();
        return { provider: 'gemini', model, text: textOf(d), tool_calls: [], usage: usageOf(d), stop_reason: (d.candidates && d.candidates[0] && d.candidates[0].finishReason) || null };
      } catch {
        throw new ModelError(CODES.UPSTREAM, 'gemini resposta inválida', { provider: 'gemini' });
      } finally { t.done(); }
    },

    async *stream(model, req) {
      const { res, t } = await post(model, req, true);
      let usage = { input_tokens: 0, output_tokens: 0 };
      let stop = null;
      try {
        for await (const data of sseData(res.body)) {
          let p;
          try { p = JSON.parse(data); } catch { continue; }
          if (p.usageMetadata) usage = usageOf(p);
          if (p.candidates && p.candidates[0] && p.candidates[0].finishReason) stop = p.candidates[0].finishReason;
          const txt = textOf(p);
          if (txt) yield { type: 'text', text: txt };
        }
        yield { type: 'done', usage, stop_reason: stop, tool_calls: [] };
      } catch (e) {
        if (e instanceof ModelError) throw e;
        if (t.signal.aborted) throw new ModelError(CODES.ABORTED, 'Stream do Gemini cancelado ou expirado.', { provider: 'gemini' });
        throw new ModelError(CODES.UPSTREAM, 'gemini stream interrompido', { provider: 'gemini' });
      } finally {
        t.done();
        try { await res.body.cancel(); } catch { /* já consumido */ }
      }
    },
  };
}

module.exports = { createGeminiProvider, ENV_KEY };
