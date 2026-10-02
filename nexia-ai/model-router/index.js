'use strict';
// Model Router (spec §16, plano Fase 5). Um único ponto para chamar modelos:
//   chat, stream (streaming real), toolCall, structuredOutput, capabilities, costEstimate,
// e as variantes com fallback usadas pelo cortex-chat. Cada provedor implementa a
// interface ModelProvider:
//   { id, envKey, available(), capabilities(model), chat(model, req), stream?(model, req) }
// O modelo é sempre um descritor { provider, model }; os catálogos (rótulos, intents,
// modelos gratuitos) continuam com os chamadores (cortex-chat, multi-model-engine).
const { ModelError, CODES } = require('./errors');
const { normalizeRequest } = require('./messages');
const { costEstimate } = require('./pricing');
const { createAnthropicProvider } = require('./providers/anthropic');
const { createOpenAICompatibleProvider, PROVIDERS: OPENAI_COMPATIBLE } = require('./providers/openai-compatible');
const { createGeminiProvider } = require('./providers/gemini');
const { createCohereProvider } = require('./providers/cohere');

const PROVIDER_IDS = Object.freeze(['anthropic', 'gemini', 'cohere', ...Object.keys(OPENAI_COMPATIBLE)]);

/**
 * @param {{ env?, fetchImpl?, baseUrls?: Record<string,string>, anthropicClientOptions?, providers?: Record<string, object> }} [o]
 *   baseUrls/fetchImpl/providers servem para testes apontarem para servidores falsos.
 */
function createRouter(o = {}) {
  const env = o.env || process.env;
  const fetchImpl = o.fetchImpl;
  const base = o.baseUrls || {};
  const providers = {};
  providers.anthropic = createAnthropicProvider({ env, clientOptions: { ...(base.anthropic ? { baseURL: base.anthropic } : {}), ...(o.anthropicClientOptions || {}) } });
  providers.gemini = createGeminiProvider({ env, ...(fetchImpl ? { fetchImpl } : {}), ...(base.gemini ? { baseUrl: base.gemini } : {}) });
  providers.cohere = createCohereProvider({ env, ...(fetchImpl ? { fetchImpl } : {}), ...(base.cohere ? { baseUrl: base.cohere } : {}) });
  for (const id of Object.keys(OPENAI_COMPATIBLE)) {
    providers[id] = createOpenAICompatibleProvider(id, { env, ...(fetchImpl ? { fetchImpl } : {}), ...(base[id] ? { baseUrl: base[id] } : {}) });
  }
  Object.assign(providers, o.providers || {});

  const providerFor = desc => {
    const p = desc && providers[desc.provider];
    if (!p) throw new ModelError(CODES.UNKNOWN_PROVIDER, `Provedor desconhecido: ${desc && desc.provider}`);
    if (!desc.model || typeof desc.model !== 'string') throw new ModelError(CODES.UNKNOWN_PROVIDER, 'Modelo não informado.');
    return p;
  };

  function capabilities(desc) {
    const p = providerFor(desc);
    return { ...p.capabilities(desc.model), available: p.available() };
  }

  async function chat(desc, req) {
    const p = providerFor(desc);
    return p.chat(desc.model, normalizeRequest(req));
  }

  /** Streaming real: cada trecho sai do provedor e é repassado na hora. */
  async function* stream(desc, req) {
    const p = providerFor(desc);
    const r = normalizeRequest(req);
    if (!p.stream || !p.capabilities(desc.model).streaming) {
      const out = await p.chat(desc.model, r);
      if (out.text) yield { type: 'text', text: out.text };
      yield { type: 'done', usage: out.usage, stop_reason: out.stop_reason, tool_calls: out.tool_calls };
      return;
    }
    yield* p.stream(desc.model, r);
  }

  async function toolCall(desc, req) {
    const p = providerFor(desc);
    if (!p.capabilities(desc.model).tool_call) throw new ModelError(CODES.UNSUPPORTED, `${desc.provider} não suporta tool_call.`, { provider: desc.provider });
    if (!req || !Array.isArray(req.tools) || !req.tools.length) throw new ModelError(CODES.UNSUPPORTED, 'toolCall exige tools.');
    return p.chat(desc.model, normalizeRequest(req));
  }

  /**
   * Saída estruturada validada contra um JSON Schema simples (object/required/tipos).
   * Com tool_call: força uma ferramenta cujo input_schema é o schema. Sem: pede JSON e valida.
   */
  async function structuredOutput(desc, req, schema, name = 'resposta') {
    const p = providerFor(desc);
    let data;
    let out;
    if (p.capabilities(desc.model).tool_call) {
      out = await p.chat(desc.model, normalizeRequest({ ...req, tools: [{ name, description: 'Devolva a resposta neste formato.', input_schema: schema }], toolChoice: name }));
      const call = out.tool_calls.find(c => c.name === name);
      data = call ? call.input : undefined;
    } else {
      const sys = `${req.system ? req.system + '\n\n' : ''}Responda SOMENTE com um objeto JSON válido que siga este JSON Schema, sem texto fora do JSON:\n${JSON.stringify(schema)}`;
      out = await p.chat(desc.model, normalizeRequest({ ...req, system: sys }));
      const m = String(out.text || '').match(/\{[\s\S]*\}/);
      try { data = m ? JSON.parse(m[0]) : undefined; } catch { data = undefined; }
    }
    const problems = data === undefined ? ['sem JSON na resposta'] : validate(schema, data);
    if (problems.length) throw new ModelError(CODES.INVALID_OUTPUT, 'Saída estruturada inválida.', { provider: desc.provider, problems: problems.slice(0, 10) });
    return { data, usage: out.usage, provider: out.provider, model: out.model };
  }

  /** Tenta cada descritor até um responder. Erros por provedor ficam em `attempts`. */
  async function chatWithFallback(descs, req) {
    const attempts = [];
    for (const d of dedupe(descs)) {
      try { return { ...(await chat(d, req)), attempts }; }
      catch (e) {
        if (e && e.code === CODES.ABORTED) throw e;
        attempts.push({ provider: d.provider, model: d.model, code: e.code || 'ERROR' });
      }
    }
    throw new ModelError(CODES.ALL_FAILED, 'Nenhum modelo respondeu.', { attempts });
  }

  /**
   * Streaming com fallback: troca de provedor só enquanto nenhum texto foi entregue.
   * Emite { type:'model', provider, model, attempts } antes do primeiro texto; um erro
   * depois disso vira { type:'error', code } e encerra (o texto já saiu para o cliente).
   */
  async function* streamWithFallback(descs, req) {
    const attempts = [];
    for (const d of dedupe(descs)) {
      const it = stream(d, req)[Symbol.asyncIterator]();
      let first;
      try {
        first = await it.next();
      } catch (e) {
        if (e && e.code === CODES.ABORTED) throw e;
        attempts.push({ provider: d.provider, model: d.model, code: e.code || 'ERROR' });
        continue;
      }
      yield { type: 'model', provider: d.provider, model: d.model, attempts };
      try {
        if (!first.done) yield first.value;
        while (true) {
          const n = await it.next();
          if (n.done) break;
          yield n.value;
        }
      } catch (e) {
        yield { type: 'error', code: (e && e.code) || 'ERROR' };
      } finally {
        if (typeof it.return === 'function') { try { await it.return(); } catch { /* encerrado */ } }
      }
      return;
    }
    throw new ModelError(CODES.ALL_FAILED, 'Nenhum modelo respondeu.', { attempts });
  }

  return {
    providers: Object.keys(providers),
    capabilities,
    chat,
    stream,
    toolCall,
    structuredOutput,
    chatWithFallback,
    streamWithFallback,
    costEstimate: (desc, usage) => costEstimate(desc.provider, desc.model, usage),
  };
}

function dedupe(descs) {
  const seen = new Set();
  return (descs || []).filter(d => d && !seen.has(`${d.provider}|${d.model}`) && seen.add(`${d.provider}|${d.model}`));
}

/** Validador mínimo de JSON Schema: type, required, properties, items, enum. */
function validate(schema, value, path = '$') {
  const out = [];
  if (!schema || typeof schema !== 'object') return out;
  const type = schema.type;
  const is = {
    object: v => v !== null && typeof v === 'object' && !Array.isArray(v),
    array: Array.isArray,
    string: v => typeof v === 'string',
    number: v => typeof v === 'number' && Number.isFinite(v),
    integer: v => Number.isInteger(v),
    boolean: v => typeof v === 'boolean',
    null: v => v === null,
  };
  if (type && is[type] && !is[type](value)) return [`${path}: esperado ${type}`];
  if (schema.enum && !schema.enum.includes(value)) out.push(`${path}: fora de enum`);
  if (type === 'object') {
    for (const k of schema.required || []) if (!(k in value)) out.push(`${path}.${k}: obrigatório`);
    for (const [k, s] of Object.entries(schema.properties || {})) if (k in value) out.push(...validate(s, value[k], `${path}.${k}`));
  }
  if (type === 'array' && schema.items) value.forEach((v, i) => out.push(...validate(schema.items, v, `${path}[${i}]`)));
  return out;
}

let shared = null;
/** Router do processo (env real). Testes usam createRouter com dependências próprias. */
function getRouter() {
  if (!shared) shared = createRouter();
  return shared;
}

module.exports = { createRouter, getRouter, validate, ModelError, CODES, PROVIDER_IDS };
