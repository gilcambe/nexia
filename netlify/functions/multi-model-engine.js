'use strict';

const { guard, HEADERS, makeHeaders } = require('./middleware');

const MODELS = {
  groq_llama3:       { id: 'llama-3.3-70b-versatile',             provider: 'groq' },
  groq_mixtral:      { id: 'mixtral-8x7b-32768',          provider: 'groq' },
  groq_llama3_fast:  { id: 'llama-3.1-8b-instant',        provider: 'groq' },
  deepseek_chat:     { id: 'deepseek-chat',                provider: 'deepseek' },
  deepseek_coder:    { id: 'deepseek-coder',               provider: 'deepseek' },
  openai_gpt4o:      { id: 'gpt-4o',                      provider: 'openai' },
  openai_gpt4_mini:  { id: 'gpt-4o-mini',                 provider: 'openai' },
  gemini:            { id: 'gemini-2.0-flash',             provider: 'gemini' },
  gpt4o:             { id: 'gpt-4o',                      provider: 'openai' },
  grok3:             { id: 'grok-3-fast',                 provider: 'xai' },
  anthropic:         { id: 'claude-sonnet-4-5',            provider: 'anthropic' },
  claude_sonnet:     { id: 'claude-sonnet-4-5',            provider: 'anthropic' },
  claude_opus:       { id: 'claude-opus-4-5',              provider: 'anthropic' },
};

// NEXIA AI (Fase 5): chamadas via Model Router (SDK oficial no Claude). Os padrões de
// max_tokens/temperature anteriores foram mantidos: 4096 no Anthropic, 2000 e 0.7 nos demais.
const modelRouter = require('../../nexia-ai/model-router');

async function callModel(modelKey, messages, options = {}) {
  const model = MODELS[modelKey];
  if (!model) throw new Error(`Modelo desconhecido: "${modelKey}". Disponíveis: ${Object.keys(MODELS).join(', ')}`);
  const { provider, id } = model;
  const anthropic = provider === 'anthropic';
  const out = await modelRouter.getRouter().chat({ provider, model: id }, {
    messages: Array.isArray(messages) ? messages : [],
    maxTokens: options.max_tokens || (anthropic ? 4096 : 2000),
    temperature: options.temperature !== undefined ? options.temperature : (anthropic ? undefined : 0.7),
  });
  return out.text;
}

exports.handler = async (event) => {
  const headers = makeHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    const g = await guard(event, 'multi-model-engine');
  if (g) return g;
  try {
    const { action, messages, model = 'groq_llama3', options = {} } = JSON.parse(event.body || '{}');
    if (action === 'call') {
      const reply = await callModel(model, messages, options);
      return { statusCode: 200, headers, body: JSON.stringify({ reply, modelUsed: model }) };
    }
    if (action === 'list') {
      const router = modelRouter.getRouter();
      const details = Object.fromEntries(Object.entries(MODELS).map(([k, m]) => {
        const d = { provider: m.provider, model: m.id };
        return [k, { ...d, capabilities: router.capabilities(d) }];
      }));
      return { statusCode: 200, headers, body: JSON.stringify({ models: Object.keys(MODELS), details }) };
    }
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid action' }) };
  } catch (err) { return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error' }) }; }
};
exports.callModel = callModel;
exports.MODELS = MODELS; // NEXIA AI (Fase 5): teste de cobertura do catálogo pelo Model Router
