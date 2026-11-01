'use strict';
// #956: cache em memória (24 h) para respostas SEM ferramentas. Dividir tarefa e revisões curtas repetem
// pedidos iguais; responder do cache economiza a cota grátis. Só vale quando o chamador pede (req.cache === true).
// #1824: cache no D1 (7 dias) para respostas SEM ferramentas e SEM dados de cliente.
const { D1Database } = require('@cloudflare/workers-types');
const { createEmbedding } = require('@cf/baai/bge-small-en-v1.5');

// #1824: cache no D1 (7 dias) para respostas SEM ferramentas e SEM dados de cliente.
const { D1Database } = require('@cloudflare/workers-types');
const { createEmbedding } = require('@cf/baai/bge-small-en-v1.5');
=======
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
    stats() {
      return { hits: hitsCount, economiaTokens: economiaTokensTotal, size: m.size };
    },
    resetStats() {
      hitsCount = 0;
      economiaTokensTotal = 0;
    }
  };
}

let sharedCacheInstance = null;
function getSharedCache() {
  if (!sharedCacheInstance) sharedCacheInstance = createCache();
  return sharedCacheInstance;
}

/** Pode usar o cache? Só com req.cache === true e sem ferramentas. */
const cacheavel = req => !!req && req.cache === true && !(Array.isArray(req.tools) ? req.tools.length : req.tools);

module.exports = { createCache, getSharedCache, chave, cacheavel, normalizar };
