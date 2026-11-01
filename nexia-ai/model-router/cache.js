'use strict';
// #956: cache em memória (24 h) para respostas SEM ferramentas. Dividir tarefa e revisões curtas repetem
// pedidos iguais; responder do cache economiza a cota grátis. Só vale quando o chamador pede (req.cache === true).
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// #830: chave "semântica" = texto normalizado (espaços, quebras de linha e maiúsculas não mudam a pergunta).
const normalizar = t => String(t == null ? '' : typeof t === 'string' ? t : JSON.stringify(t)).replace(/\s+/g, ' ').trim().toLowerCase();
const normalizarSystem = s => normalizar(s).replace(/hora brt:\s*[^|#\n]+/gi, 'hora brt: [data]');

/** Chave = sha256 de { system, messages } normalizados; o modelo não entra aqui (o router acrescenta). */
function chave(req) {
  const msgs = ((req && req.messages) || []).map(m => ({ role: m && m.role, content: normalizar(m && m.content) }));
  return createHash('sha256').update(JSON.stringify({ system: normalizarSystem(req && req.system), messages: msgs })).digest('hex');
}

let hitsCount = 0;
let economiaTokensTotal = 0;

/** Map com ordem de uso: o mais antigo sai quando passa de `max`; item vencido é ignorado e removido. */
// `arquivo` (opcional, desligado por padrão): guarda o cache em JSON para a próxima rodada reaproveitar.
function createCache({ max = 500, ttlMs = 24 * 3600e3, agora = () => Date.now(), arquivo = '' } = {}) {
  const m = new Map();
  if (arquivo) {
    try { for (const [k, e] of Object.entries(JSON.parse(fs.readFileSync(arquivo, 'utf8')))) if (e && e.ate > agora()) m.set(k, e); } catch { /* sem arquivo ainda */ }
  }
  const gravar = () => {
    if (!arquivo) return;
    try { fs.mkdirSync(path.dirname(arquivo), { recursive: true }); fs.writeFileSync(arquivo, JSON.stringify(Object.fromEntries(m))); } catch { /* disco cheio ou só leitura: segue em memória */ }
  };
  return {
    get(k) {
      const e = m.get(k);
      if (!e) return undefined;
      if (e.ate <= agora()) { m.delete(k); return undefined; }
      m.delete(k); m.set(k, e);   // vai para o fim (usado agora)
      hitsCount++;
      const tok = (e.valor && e.valor.usage && e.valor.usage.total_tokens) || (e.valor && e.valor.text ? Math.ceil(e.valor.text.length / 4) : 150);
      economiaTokensTotal += tok;
      return e.valor;
    },
    set(k, valor) {
      m.delete(k);
      m.set(k, { valor, ate: agora() + ttlMs });
      while (m.size > max) m.delete(m.keys().next().value);
      gravar();
    },
    get size() { return m.size; },
    /** #2853: itens válidos mais recentes, até `maxBytes` de JSON (o D1 guarda um documento). */
    exportar(maxBytes = 600e3) {
      const out = {}; let bytes = 2;
      for (const [k, e] of [...m.entries()].reverse()) {
        if (e.ate <= agora()) continue;
        const t = JSON.stringify(e).length + k.length + 4;
        if (bytes + t > maxBytes) break;
        out[k] = e; bytes += t;
      }
      return out;
    },
    /** Junta o que veio do D1 sem apagar o que este processo já tem; ignora vencidos. */
    importar(obj) {
      if (!obj || typeof obj !== 'object') return 0;
      let n = 0;
      for (const [k, e] of Object.entries(obj)) {
        if (!e || typeof e.ate !== 'number' || e.ate <= agora() || m.has(k)) continue;
        m.set(k, e); n++;
      }
      while (m.size > max) m.delete(m.keys().next().value);
      return n;
    },
    stats() {
      return { hits: hitsCount, economiaTokens: economiaTokensTotal, size: m.size };
    },
    resetStats() {
      hitsCount = 0;
      economiaTokensTotal = 0;
    }
  };
}

// #2853: o cache compartilhado vale 7 dias e vai para o D1 grátis entre os jobs (cada job do Actions começa do zero).
const SETE_DIAS = 7 * 24 * 3600e3;
let sharedCacheInstance = null;
function getSharedCache() {
  if (!sharedCacheInstance) sharedCacheInstance = createCache({ ttlMs: SETE_DIAS });
  return sharedCacheInstance;
}

const DOC_CACHE = 'ia_cota/cache';
function driverD1(env, o) {
  if (o && o.driver) return o.driver;
  if (!env.NEXIA_D1_TOKEN || !env.NEXIA_D1_ACCOUNT_ID) return null;
  const { createD1Driver } = require('../../lib/firebase-lite/d1-backend');
  return createD1Driver({ token: env.NEXIA_D1_TOKEN, accountId: env.NEXIA_D1_ACCOUNT_ID });
}
async function carregarCacheDoD1(env = process.env, o = {}) {
  try {
    const d = driverD1(env, o);
    if (!d) return false;
    const doc = (await d.get([DOC_CACHE])).get(DOC_CACHE);
    (o.cache || getSharedCache()).importar(doc && doc.fields && doc.fields.itens);
    return true;
  } catch (e) { console.warn('[cache] não li o cache do D1:', e && e.message); return false; }
}
/** Junta com o que outro job salvou e grava (só respostas pedidas com req.cache === true e sem ferramentas). */
async function salvarCacheNoD1(env = process.env, o = {}) {
  try {
    const d = driverD1(env, o);
    if (!d) return false;
    const c = o.cache || getSharedCache();
    const atual = (await d.get([DOC_CACHE])).get(DOC_CACHE);
    c.importar(atual && atual.fields && atual.fields.itens);
    const agora = new Date().toISOString();
    await d.apply([{ type: 'upsert', path: DOC_CACHE, fields: { itens: c.exportar() }, create_time: (atual && atual.create_time) || agora, update_time: agora }]);
    return true;
  } catch (e) { console.warn('[cache] não salvei o cache no D1:', e && e.message); return false; }
}

/** Pode usar o cache? Só com req.cache === true e sem ferramentas. */
const cacheavel = req => !!req && req.cache === true && !(Array.isArray(req.tools) ? req.tools.length : req.tools);

module.exports = { createCache, getSharedCache, chave, cacheavel, normalizar, DOC_CACHE, SETE_DIAS, carregarCacheDoD1, salvarCacheNoD1 };
