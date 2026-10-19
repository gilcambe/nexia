'use strict';
// #956: cache em memória (24 h) para respostas SEM ferramentas. Dividir tarefa e revisões curtas repetem
// pedidos iguais; responder do cache economiza a cota grátis. Só vale quando o chamador pede (req.cache === true).
const { createHash } = require('node:crypto');

/** Chave = sha256 de { system, messages }; o modelo não entra (qualquer grátis que respondeu serve). */
function chave(req) {
  return createHash('sha256').update(JSON.stringify({ system: (req && req.system) || '', messages: (req && req.messages) || [] })).digest('hex');
}

/** Map com ordem de uso: o mais antigo sai quando passa de `max`; item vencido é ignorado e removido. */
function createCache({ max = 500, ttlMs = 24 * 3600e3, agora = () => Date.now() } = {}) {
  const m = new Map();
  return {
    get(k) {
      const e = m.get(k);
      if (!e) return undefined;
      if (e.ate <= agora()) { m.delete(k); return undefined; }
      m.delete(k); m.set(k, e);   // vai para o fim (usado agora)
      return e.valor;
    },
    set(k, valor) {
      m.delete(k);
      m.set(k, { valor, ate: agora() + ttlMs });
      while (m.size > max) m.delete(m.keys().next().value);
    },
    get size() { return m.size; },
  };
}

/** Pode usar o cache? Só com req.cache === true e sem ferramentas. */
const cacheavel = req => !!req && req.cache === true && !(Array.isArray(req.tools) ? req.tools.length : req.tools);

module.exports = { createCache, chave, cacheavel };
