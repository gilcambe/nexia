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
const { createMaquinasProvider } = require('./providers/maquinas');
const { createCache, getSharedCache, chave, cacheavel } = require('./cache');
const { textoSemantico, escopoDe, criarEmbedWorkersAI, getCacheSemantico } = require('./cache-semantico');
const { encolher } = require('./contexto');

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
  providers.maquinas = createMaquinasProvider({ env });   // #2826: PCs do dono (Ollama), só tarefas internas leves
  for (const id of Object.keys(OPENAI_COMPATIBLE)) {
    providers[id] = createOpenAICompatibleProvider(id, { env, ...(fetchImpl ? { fetchImpl } : {}), ...(base[id] ? { baseUrl: base[id] } : {}) });
  }
  // Vagas "Outra IA (compatível com OpenAI)": cada uma vira o provedor vaga-N.
  for (const c of vagasCustom(o.env || process.env)) {
    providers[c.provider] = createOpenAICompatibleProvider(c.provider, { env: { [c.envKey]: c.chave }, ...(fetchImpl ? { fetchImpl } : {}), cfg: c.cfg });
  }
  Object.assign(providers, o.providers || {});

  // #2848: todo pedido conta no crédito interno do provedor (pedidos, tokens, 429). Contar nunca quebra a resposta.
  const uso = o.uso || require('./cota').getUso();
  const { registrarErro429, obterCotaDisponivel, disjuntorAberto } = require('./cota');
  const contar = (id, inc) => { 
    try { 
      uso.incrementUsage(id, inc); 
    } catch { /* sem conta, segue */ } 
  };
  
  const { selecionarProvider } = require('../../src/utils/providerSelector');
  const { tetosConfigurados } = require('../../src/config/limits');
  const tokensDe = out => (out && out.usage && (out.usage.total_tokens || ((out.usage.input_tokens || 0) + (out.usage.output_tokens || 0)))) || (out && out.text ? Math.ceil(out.text.length / 4) : 0);
  const e429 = e => (e && e.details && e.details.status === 429) ? 1 : 0;
  const contados = new Map();
  function contado(id, p) {
    if (contados.has(id)) return contados.get(id);
    const w = Object.create(p);
    w.chat = async (model, req) => {
      try { 
        const out = await p.chat(model, req); 
        contar(id, { requests: 1, tokens: tokensDe(out) }); 
        return out; 
      }
      catch (e) { 
        if (e429(e)) {
          try { registrarErro429(id); } catch {}
        }
        contar(id, { requests: 1, errors: e429(e) }); 
        throw e; 
      }
    };
    if (typeof p.stream === 'function') {
      w.stream = async function* (model, req) {
        let texto = 0; let usage = null;
        try {
          for await (const ev of p.stream(model, req)) {
            if (ev && ev.type === 'text' && ev.text) texto += ev.text.length;
            if (ev && ev.type === 'done' && ev.usage) usage = ev.usage;
            yield ev;
          }
          contar(id, { requests: 1, tokens: tokensDe({ usage }) || Math.ceil(texto / 4) });
        } catch (e) { 
          if (e429(e)) {
            try { registrarErro429(id); } catch {}
          }
          contar(id, { requests: 1, errors: e429(e) }); 
          throw e; 
        }
      };
    }
    contados.set(id, w);
    return w;
  }
  const providerFor = desc => {
    const id = desc && desc.provider;
    if (disjuntorAberto && disjuntorAberto(id)) {
      throw new ModelError(CODES.UPSTREAM, `Disjuntor aberto para o provedor: ${id}`, { provider: id, status: 503 });
    }
    const cota = obterCotaDisponivel ? obterCotaDisponivel(id) : null;
    if (cota !== null && cota <= 0) {
      throw new ModelError(CODES.UPSTREAM, `Sem cota disponível para o provedor: ${id}`, { provider: id, status: 429 });
    }
    const p = desc && providers[id];
    if (!p) throw new ModelError(CODES.UNKNOWN_PROVIDER, `Provedor desconhecido: ${desc && desc.provider}`);
    if (!desc.model || typeof desc.model !== 'string') throw new ModelError(CODES.UNKNOWN_PROVIDER, 'Modelo não informado.');
    return contado(id, p);
  };

  function capabilities(desc) {
    const p = providerFor(desc);
    return { ...p.capabilities(desc.model), available: p.available() };
  }

  // #956: respostas sem ferramentas pedidas com req.cache === true ficam 24 h em memória (sem req.cache, nada muda).
  // #830: NEXIA_CACHE_ARQUIVO (opcional) guarda o cache em disco entre rodadas.
  // #2853: sem arquivo, usa o cache compartilhado (7 dias), que o job carrega do D1 e salva no fim.
  const arquivoCache = (o.env || process.env).NEXIA_CACHE_ARQUIVO || '';
  const cache = o.cache || (arquivoCache ? createCache({ arquivo: arquivoCache }) : getSharedCache());
  // #2854: cache semântico (mesmo sentido, outras palavras) com embeddings grátis do Workers AI.
  const embed = o.embed !== undefined ? o.embed : criarEmbedWorkersAI(o.env || process.env);
  const cacheSem = o.cacheSemantico || getCacheSemantico();
  async function chat(desc, req) {
    const p = providerFor(desc);
    // #2855: conversa grande demais é resumida antes de ir ao modelo (menos tokens, menos 413).
    req = encolher(req, o.env || process.env).req;
    if (!cacheavel(req)) return p.chat(desc.model, normalizeRequest(req));
    // Modelo entra na chave: resposta ruim de um modelo não vira a resposta do próximo do rodízio.
    const k = `${desc.provider}|${desc.model}|${chave(req)}`;
    const hit = cache.get(k);
    if (hit) return { ...hit, cached: true };
    const ts = embed ? textoSemantico(req) : null;
    const vetor = ts ? await embed(ts) : null;
    if (vetor) {
      const s = cacheSem.buscar(vetor, escopoDe(req));
      if (s) return { ...s.valor, cached: true, semantic: true, similaridade: s.similaridade };
    }
    const { cache: _c, ...limpo } = req;
    const out = await p.chat(desc.model, normalizeRequest(limpo));
    if (out && !(out.tool_calls || []).length) {
      cache.set(k, out);
      if (vetor && out.text) cacheSem.guardar(vetor, escopoDe(req), out);
    }
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
    const env = o.env || process.env;
    const treinaComDados = (req && req.treina_com_dados) || env.TREINA_COM_DADOS;
    const size = (req && req.tamanho) || (req && req.size) || 'media';
    
    let descsDedupped = dedupe(descs);
    // 5) Respeitar flag treina_com_dados = não para dados sensíveis
    if (treinaComDados === 'nao' || treinaComDados === false || treinaComDados === 'não') {
      descsDedupped = descsDedupped.filter(d => {
        const id = String(d.provider || '').toLowerCase();
        return !id.includes('public') && !id.includes('treino');
      });
    }

    // 1) Consultar cotas antes de escolher provider; 2) Pular sem cota ou disjuntor aberto
    const quotasMap = {};
    for (const d of descsDedupped) {
      const id = d.provider;
      const semCota = (obterCotaDisponivel && obterCotaDisponivel(id) !== null && obterCotaDisponivel(id) <= 0);
      const disjuntor = (disjuntorAberto && disjuntorAberto(id));
      quotasMap[id] = { esgotada: semCota || disjuntor };
    }

    let selecionados = descsDedupped;
    const placar = (() => { try { return require('./cota').getPlacar(); } catch { return null; } })();
    
    // 4) Implementar roteamento por tamanho (pequena, média, grande) usando providerSelector.js
    if (selecionarProvider) {
      try {
        selecionados = selecionarProvider(size, {
          providers: descsDedupped,
          quotas: quotasMap,
          placar,
          env
        });
      } catch {
        selecionados = descsDedupped;
      }
    }

    // Filtro adicional de segurança caso o providerSelector não tenha filtrado disjuntores ou cotas
    selecionados = selecionados.filter(d => {
      const id = d.provider;
      if (disjuntorAberto && disjuntorAberto(id)) return false;
      const c = obterCotaDisponivel ? obterCotaDisponivel(id) : null;
      if (c !== null && c <= 0) return false;
      return true;
    });

    // Garantir que Jules nunca seja o primeiro se houver outras opções
    if (selecionados.length > 1) {
      const firstId = String(selecionados[0].provider || '').toLowerCase();
      if (firstId.includes('jules')) {
        const altIndex = selecionados.findIndex(d => !String(d.provider || '').toLowerCase().includes('jules'));
        if (altIndex > 0) {
          const [alt] = selecionados.splice(altIndex, 1);
          selecionados.unshift(alt);
        }
      }
    }

    for (const d of selecionados) {
      const id = d.provider;
      if (disjuntorAberto && disjuntorAberto(id)) {
        attempts.push({ provider: id, model: d.model, code: 'CIRCUIT_BREAKER' });
        continue;
      }
      const cota = obterCotaDisponivel ? obterCotaDisponivel(id) : null;
      if (cota !== null && cota <= 0) {
        attempts.push({ provider: id, model: d.model, code: 'NO_QUOTA' });
        continue;
      }
      try { return { ...(await chat(d, req)), attempts }; }
      catch (e) {
        // 3) Ao receber 429, marcar provider como indisponível e trocar imediatamente
        if (e429(e)) {
          try { registrarErro429(id); } catch {}
        }
        if (e && e.code === CODES.ABORTED) throw e;
        attempts.push({ provider: id, model: d.model, code: e429(e) ? '429_TOO_MANY_REQUESTS' : (e.code || 'ERROR') });
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

    let currentReq = encolher(req, o.env || process.env).req; // #2855
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

    const descsForStream = dedupe(descs).filter(d => {
      const id = d.provider;
      if (disjuntorAberto && disjuntorAberto(id)) return false;
      const cota = obterCotaDisponivel ? obterCotaDisponivel(id) : null;
      if (cota !== null && cota <= 0) return false;
      return true;
    });

    for (let i = 0; i < descsForStream.length; i++) {
      if (Date.now() - startTime >= totalTimeoutMs) {
        break;
      }
      const d = descsForStream[i];

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
          const d = descsForStream[i] || descsForStream[0];
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
