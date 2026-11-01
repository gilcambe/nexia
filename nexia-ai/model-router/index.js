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
const { aplicarVagas, vagasCustom } = require('./vagas');
const { createGeminiProvider } = require('./providers/gemini');
const { createCohereProvider } = require('./providers/cohere');
const { createCache, chave, cacheavel } = require('./cache');

const PROVIDER_IDS = Object.freeze(['anthropic', 'gemini', 'cohere', ...Object.keys(OPENAI_COMPATIBLE)]);

/**
 * @param {{ env?, fetchImpl?, baseUrls?: Record<string,string>, anthropicClientOptions?, providers?: Record<string, object> }} [o]
 *   baseUrls/fetchImpl/providers servem para testes apontarem para servidores falsos.
 */
function createRouter(o = {}) {
  // #2716: chaves das vagas da Central (IA_VAGA_1..50) entram onde o provedor ainda não tem chave.
  const env = aplicarVagas(o.env || process.env);
  const fetchImpl = o.fetchImpl;
  const base = o.baseUrls || {};
  const providers = {};
  providers.anthropic = createAnthropicProvider({ env, clientOptions: { ...(base.anthropic ? { baseURL: base.anthropic } : {}), ...(o.anthropicClientOptions || {}) } });
  providers.gemini = createGeminiProvider({ env, ...(fetchImpl ? { fetchImpl } : {}), ...(base.gemini ? { baseUrl: base.gemini } : {}) });
  providers.cohere = createCohereProvider({ env, ...(fetchImpl ? { fetchImpl } : {}), ...(base.cohere ? { baseUrl: base.cohere } : {}) });
  for (const id of Object.keys(OPENAI_COMPATIBLE)) {
    providers[id] = createOpenAICompatibleProvider(id, { env, ...(fetchImpl ? { fetchImpl } : {}), ...(base[id] ? { baseUrl: base[id] } : {}) });
  }
  // Vagas "Outra IA (compatível com OpenAI)": cada uma vira o provedor vaga-N.
  for (const c of vagasCustom(o.env || process.env)) {
    providers[c.provider] = createOpenAICompatibleProvider(c.provider, { env: { [c.envKey]: c.chave }, ...(fetchImpl ? { fetchImpl } : {}), cfg: c.cfg });
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

  // #956: respostas sem ferramentas pedidas com req.cache === true ficam 24 h em memória (sem req.cache, nada muda).
  // #830: NEXIA_CACHE_ARQUIVO (opcional) guarda o cache em disco entre rodadas.
  const cache = o.cache || createCache({ arquivo: (o.env || process.env).NEXIA_CACHE_ARQUIVO || '' });
  async function chat(desc, req) {
    const p = providerFor(desc);
    if (!cacheavel(req)) return p.chat(desc.model, normalizeRequest(req));
    // Modelo entra na chave: resposta ruim de um modelo não vira a resposta do próximo do rodízio.
    const k = `${desc.provider}|${desc.model}|${chave(req)}`;
    const hit = cache.get(k);
    if (hit) return { ...hit, cached: true };
    const { cache: _c, ...limpo } = req;
    const out = await p.chat(desc.model, normalizeRequest(limpo));
    if (out && !(out.tool_calls || []).length) cache.set(k, out);
    return out;
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
   * Streaming com fallback resiliente:
   * 1. Primeiro token: se não chegar em 4 s (firstChunkTimeoutMs), troca de provedor.
   * 2. Meio da resposta: se parar por mais de 8 s (stallTimeoutMs), continua com outro provedor a partir do que já foi escrito.
   * 3. Limite total: 60 s máximo.
   */
  async function* streamWithFallback(descs, req, options = {}) {
    const firstChunkTimeoutMs = options.firstChunkTimeoutMs || (req && req.firstChunkTimeoutMs) || 4000;
    const stallTimeoutMs = options.stallTimeoutMs || (req && req.stallTimeoutMs) || 8000;
    const totalTimeoutMs = options.totalTimeoutMs || (req && req.totalTimeoutMs) || 60000;
    const startTime = Date.now();
    const attempts = [];
    const getPlacar = () => { try { return require('./cota').getPlacar(); } catch { return null; } };

    const remainingTime = () => Math.max(10, totalTimeoutMs - (Date.now() - startTime));

    const timeoutPromise = (ms, msg) => new Promise((_, reject) => {
      const timer = setTimeout(() => {
        const err = new ModelError(CODES.UPSTREAM, msg || 'Timeout');
        err.isTimeout = true;
        reject(err);
      }, ms);
      if (timer.unref) timer.unref();
    });

    let currentReq = req;
    let accumulatedText = '';
    const dedupped = dedupe(descs);

    if (cacheavel(req)) {
      const generalK = `gen|${chave(req)}`;
      for (const d of dedupped) {
        const k = `${d.provider}|${d.model}|${chave(req)}`;
        const hit = cache.get(k) || cache.get(generalK);
        if (hit) {
          yield { type: 'model', provider: hit.provider || d.provider, model: hit.model || d.model, attempts: [], cached: true };
          if (hit.text) yield { type: 'text', text: hit.text };
          yield { type: 'done', usage: hit.usage || {}, stop_reason: 'stop', cached: true };
          return;
        }
      }
    }

    for (let i = 0; i < dedupped.length; i++) {
      if (Date.now() - startTime >= totalTimeoutMs) {
        break;
      }
      const d = dedupped[i];

      const placar = getPlacar();
      if (placar && placar.bloqueado(d) && dedupped.length > 1) {
        attempts.push({ provider: d.provider, model: d.model, code: 'BLOCKED' });
        continue;
      }

      let contReq = currentReq;
      if (accumulatedText) {
        const history = [...(currentReq.messages || [])];
        contReq = {
          ...currentReq,
          messages: [
            ...history,
            { role: 'assistant', content: accumulatedText },
            { role: 'user', content: '[INSTRUÇÃO DE CONTINUAÇÃO: Continue exatamente de onde parou a resposta anterior, sem repetir o que já foi escrito.]' }
          ]
        };
      }

      const it = stream(d, contReq)[Symbol.asyncIterator]();
      let first;
      const tFirst = Math.min(firstChunkTimeoutMs, remainingTime());

      try {
        first = await Promise.race([
          it.next(),
          timeoutPromise(tFirst, 'Primeira palavra não chegou em 4 s')
        ]);
      } catch (e) {
        if (typeof it.return === 'function') { try { await it.return(); } catch {} }
        if (placar) placar.marcar(d, 'transient');
        if (e && e.code === CODES.ABORTED) throw e;
        attempts.push({ provider: d.provider, model: d.model, code: e.isTimeout ? 'TIMEOUT_4S' : (e.code || 'ERROR') });
        continue;
      }

      if (!accumulatedText) {
        yield { type: 'model', provider: d.provider, model: d.model, attempts };
      }

      let currentStreamDone = false;
      try {
        let nextItem = first;
        while (!nextItem.done) {
          const val = nextItem.value;
          if (val && val.type === 'text' && val.text) {
            accumulatedText += val.text;
          }
          yield val;

          if (Date.now() - startTime >= totalTimeoutMs) {
            currentStreamDone = true;
            break;
          }

          const tStall = Math.min(stallTimeoutMs, remainingTime());
          nextItem = await Promise.race([
            it.next(),
            timeoutPromise(tStall, 'Resposta parou por mais de 8 s')
          ]);
        }
        if (nextItem.done) {
          currentStreamDone = true;
        }
      } catch (e) {
        if (typeof it.return === 'function') { try { await it.return(); } catch {} }
        if (placar) placar.marcar(d, 'transient');
        attempts.push({ provider: d.provider, model: d.model, code: e.isTimeout ? 'STALL_8S' : (e.code || 'ERROR') });
        if (i < dedupped.length - 1 && Date.now() - startTime < totalTimeoutMs) {
          continue;
        }
        yield { type: 'error', code: e.isTimeout ? 'STALL_8S' : ((e && e.code) || 'ERROR') };
        return;
      } finally {
        if (typeof it.return === 'function') { try { await it.return(); } catch {} }
      }

      if (currentStreamDone) {
        if (cacheavel(req) && accumulatedText) {
          const d = dedupped[i] || descs[0];
          const k = `${d.provider}|${d.model}|${chave(req)}`;
          const generalK = `gen|${chave(req)}`;
          const cacheVal = { text: accumulatedText, provider: d.provider, model: d.model, usage: { total_tokens: Math.ceil(accumulatedText.length / 4) } };
          cache.set(k, cacheVal);
          cache.set(generalK, cacheVal);
        }
        return;
      }
    }

    if (!accumulatedText && Date.now() - startTime >= totalTimeoutMs) {
      yield { type: 'text', text: 'Não consegui agora, tente de novo.' };
      yield { type: 'done', error: 'TIMEOUT_60S' };
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
