'use strict';
// ADR-FREE-05: catálogo dos modelos grátis do Kilo Gateway (https://kilo.ai/docs/gateway).
// O gateway é compatível com OpenAI e aceita chamada SEM chave, só para modelos grátis (id terminado
// em ":free"; limite anônimo de 200 pedidos por hora por IP). Os modelos grátis mudam com o tempo, então
// a lista vem do próprio gateway (GET /models) na primeira vez em que o processo precisa dela, fica em
// cache e é ordenada pelos melhores para código e tool_call. Se a consulta falhar, vale a lista fixa.
const MODELS_URL = 'https://api.kilo.ai/api/gateway/models';
const OK_TTL = 60 * 60 * 1000;     // lista boa: 1 hora
const FAIL_TTL = 10 * 60 * 1000;   // consulta falhou: tenta de novo em 10 minutos (enquanto isso, a fixa)
const TIMEOUT = 8000;

// Exemplos citados na documentação do gateway (out/2026) e modelos ":free" conhecidos. Um que sair do ar
// devolve 404 e o Cortex passa para o próximo.
const STATIC_FREE = Object.freeze([
  'z-ai/glm-5:free', 'minimax/minimax-m2.1:free', 'qwen/qwen3-coder:free', 'openai/gpt-oss-120b:free', 'google/gemma-4-26b-a4b-it:free',
]);

// Preferência: fortes em código e tool_call primeiro; Gemma por último (mais fraco em ferramentas).
const PREFERENCE = [/glm/i, /minimax/i, /qwen.*coder/i, /kimi/i, /deepseek/i, /gpt-oss/i, /nemotron/i, /devstral/i, /qwen/i];
const LAST = [/gemma/i];

function rank(id) {
  if (LAST.some(r => r.test(id))) return PREFERENCE.length + 2;
  const i = PREFERENCE.findIndex(r => r.test(id));
  return i < 0 ? PREFERENCE.length + 1 : i;
}

const isFree = id => typeof id === 'string' && /^[A-Za-z0-9._/-]{1,110}:free$/.test(id);

/** Resposta de /models (formato OpenRouter: { data: [{ id, supported_parameters?, pricing? }] }) → ids grátis ordenados. */
function pickFree(payload) {
  const rows = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.data) ? payload.data : []);
  const ids = [];
  for (const m of rows) {
    const id = typeof m === 'string' ? m : m && m.id;
    if (!isFree(id) || ids.includes(id)) continue;
    // Quando o catálogo diz quais parâmetros o modelo aceita, só entra quem aceita ferramentas.
    if (m && Array.isArray(m.supported_parameters) && !m.supported_parameters.includes('tools')) continue;
    // Nada pago: se o catálogo trouxer preço, tem de ser zero.
    const p = m && m.pricing;
    if (p && [p.prompt, p.completion].some(v => v !== undefined && Number(v) !== 0)) continue;
    ids.push(id);
  }
  return ids.map((id, i) => ({ id, i })).sort((a, b) => rank(a.id) - rank(b.id) || a.i - b.i).map(x => x.id);
}

/**
 * Cache por instância (o router do processo é um só: getRouter()).
 * @param {{ fetchImpl: Function, env?: object, now?: () => number, url?: string }} o
 */
function createKiloCatalog({ fetchImpl, env = {}, now = () => Date.now(), url = MODELS_URL }) {
  let cache = null;   // { ids, until, source }
  let inflight = null;

  async function load() {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT);
    try {
      const headers = { Accept: 'application/json', ...(env.KILO_API_KEY ? { Authorization: `Bearer ${env.KILO_API_KEY}` } : {}) };
      const res = await fetchImpl(url, { method: 'GET', headers, signal: ctrl.signal });
      if (!res || !res.ok) throw new Error(`status ${res && res.status}`);
      const ids = pickFree(await res.json());
      if (!ids.length) throw new Error('sem modelos grátis');
      cache = { ids, until: now() + OK_TTL, source: 'gateway' };
    } catch {
      cache = { ids: [...STATIC_FREE], until: now() + FAIL_TTL, source: 'static' };
    } finally { clearTimeout(t); }
    return cache;
  }

  return {
    /** @returns {Promise<{ ids: string[], source: 'gateway'|'static' }>} */
    async list() {
      if (cache && cache.until > now()) return cache;
      if (!inflight) inflight = load().finally(() => { inflight = null; });
      return inflight;
    },
  };
}

module.exports = { createKiloCatalog, pickFree, STATIC_FREE, MODELS_URL, isFree };
