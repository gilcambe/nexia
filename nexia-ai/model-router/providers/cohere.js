'use strict';
// Adapter Cohere (API v2 /chat). Só chamada completa: o router entrega o texto como
// um único trecho quando o chamador pede streaming (capabilities.streaming = false).
const { ModelError, CODES } = require('../errors');
const { withTimeout } = require('../messages');

const ENV_KEY = 'COHERE_API_KEY';
const URL = 'https://api.cohere.ai/v2/chat';
const MAX_OUTPUT = 4096;

function createCohereProvider({ env = process.env, fetchImpl = (...a) => fetch(...a), baseUrl = URL } = {}) {
  return {
    id: 'cohere',
    envKey: ENV_KEY,
    available: () => !!env[ENV_KEY],
    capabilities: () => ({ chat: true, streaming: false, tool_call: false, structured_output: true, max_output_tokens: MAX_OUTPUT }),

    async chat(model, req) {
      const key = env[ENV_KEY];
      if (!key) throw new ModelError(CODES.NO_API_KEY, `${ENV_KEY} não configurada.`, { provider: 'cohere', env: ENV_KEY });
      if (req.tools && req.tools.length) throw new ModelError(CODES.UNSUPPORTED, 'cohere não suporta tool_call neste adapter.', { provider: 'cohere' });
      const t = withTimeout(req.signal, req.timeoutMs || 120000);
      try {
        const b = { model, max_tokens: Math.min(req.maxTokens || 4096, MAX_OUTPUT), messages: [...(req.system ? [{ role: 'system', content: req.system }] : []), ...req.messages] };
        if (req.temperature !== undefined) b.temperature = req.temperature;
        let res;
        try {
          res = await fetchImpl(baseUrl, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(b), signal: t.signal });
        } catch {
          if (t.signal.aborted) throw new ModelError(CODES.ABORTED, 'Chamada ao Cohere cancelada ou expirada.', { provider: 'cohere' });
          throw new ModelError(CODES.UPSTREAM, 'cohere erro de rede', { provider: 'cohere' });
        }
        if (!res.ok) throw new ModelError(CODES.UPSTREAM, `cohere ${res.status}`, { provider: 'cohere', status: res.status, upstream: (await res.text().catch(() => '')).slice(0, 300) });
        const d = await res.json().catch(() => { throw new ModelError(CODES.UPSTREAM, 'cohere resposta inválida', { provider: 'cohere' }); });
        const text = (d.message && d.message.content && d.message.content.map(c => c.text || '').join('')) || d.text || '';
        const u = (d.usage && (d.usage.tokens || d.usage.billed_units)) || {};
        return { provider: 'cohere', model, text, tool_calls: [], usage: { input_tokens: u.input_tokens || 0, output_tokens: u.output_tokens || 0 }, stop_reason: d.finish_reason || null };
      } finally { t.done(); }
    },
  };
}

module.exports = { createCohereProvider, ENV_KEY };
