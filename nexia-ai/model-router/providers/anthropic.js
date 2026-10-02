'use strict';
// Adapter Claude com o SDK oficial (@anthropic-ai/sdk).
// chat() também usa messages.stream(...).finalMessage(): o SDK recusa chamadas não
// streaming com max_tokens alto, e o streaming evita timeout em respostas longas.
const Anthropic = require('@anthropic-ai/sdk');
const { ModelError, CODES } = require('../errors');

const ENV_KEY = 'ANTHROPIC_API_KEY';
const DEFAULT_MAX_OUTPUT = 64000;
const MAX_OUTPUT = [[/^claude-opus-4-[01]/, 32000], [/^claude-(opus|sonnet|haiku)-4/, 64000]];

function maxOutput(model) {
  const hit = MAX_OUTPUT.find(([re]) => re.test(model));
  return hit ? hit[1] : DEFAULT_MAX_OUTPUT;
}

function capabilities(model) {
  return { chat: true, streaming: true, tool_call: true, structured_output: true, max_output_tokens: maxOutput(model) };
}

function toUpstream(e) {
  if (e instanceof ModelError) return e;
  if (e && (e.name === 'APIUserAbortError' || e.name === 'AbortError')) return new ModelError(CODES.ABORTED, 'Chamada ao Claude cancelada.');
  const status = e && typeof e.status === 'number' ? e.status : undefined;
  return new ModelError(CODES.UPSTREAM, `Anthropic ${status || 'erro de rede'}`, { provider: 'anthropic', status });
}

function createAnthropicProvider({ env = process.env, clientOptions = {} } = {}) {
  let client = null;
  let clientKey = null;
  const getClient = () => {
    const key = env[ENV_KEY];
    if (!key) throw new ModelError(CODES.NO_API_KEY, `${ENV_KEY} não configurada.`, { provider: 'anthropic', env: ENV_KEY });
    if (!client || clientKey !== key) {
      client = new Anthropic({ apiKey: key, maxRetries: 1, ...(env.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}), ...clientOptions });
      clientKey = key;
    }
    return client;
  };

  function params(model, req) {
    const p = {
      model,
      max_tokens: Math.min(req.maxTokens || 4096, maxOutput(model)),
      messages: req.messages.map(m => ({ role: m.role, content: m.content })),
    };
    if (req.system) p.system = req.system;
    if (req.temperature !== undefined) p.temperature = req.temperature;
    if (req.tools && req.tools.length) {
      p.tools = req.tools.map(t => ({ name: t.name, description: t.description || '', input_schema: t.input_schema }));
      if (req.toolChoice) p.tool_choice = req.toolChoice === 'any' ? { type: 'any' } : { type: 'tool', name: req.toolChoice };
    }
    return p;
  }

  // Só repassa opções definidas: o SDK recusa timeout undefined.
  const reqOptions = req => ({ ...(req.signal ? { signal: req.signal } : {}), ...(req.timeoutMs ? { timeout: req.timeoutMs } : {}) });

  function result(model, msg) {
    const text = (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const tool_calls = (msg.content || []).filter(b => b.type === 'tool_use').map(b => ({ id: b.id, name: b.name, input: b.input }));
    const usage = { input_tokens: msg.usage ? msg.usage.input_tokens : 0, output_tokens: msg.usage ? msg.usage.output_tokens : 0 };
    return { provider: 'anthropic', model: msg.model || model, text, tool_calls, usage, stop_reason: msg.stop_reason || null };
  }

  return {
    id: 'anthropic',
    envKey: ENV_KEY,
    available: () => !!env[ENV_KEY],
    capabilities,

    async chat(model, req) {
      const c = getClient();
      try {
        const s = c.messages.stream(params(model, req), reqOptions(req));
        return result(model, await s.finalMessage());
      } catch (e) { throw toUpstream(e); }
    },

    async *stream(model, req) {
      const c = getClient();
      let s;
      try {
        s = c.messages.stream(params(model, req), reqOptions(req));
        for await (const ev of s) {
          if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta' && ev.delta.text) {
            yield { type: 'text', text: ev.delta.text };
          }
        }
        const final = result(model, await s.finalMessage());
        yield { type: 'done', usage: final.usage, stop_reason: final.stop_reason, tool_calls: final.tool_calls };
      } catch (e) {
        throw toUpstream(e);
      } finally {
        if (s && typeof s.abort === 'function' && !s.ended) { try { s.abort(); } catch { /* já encerrado */ } }
      }
    },
  };
}

module.exports = { createAnthropicProvider, capabilities, maxOutput, ENV_KEY };
