'use strict';
// Cache em memória com LRU (Map com ordem de uso) e TTL.
// Usado pelo model-router para evitar pedidos iguais ao provedor e economizar cota.
const { createHash } = require('node:crypto');

/**
 * @param {{ max?: number, ttlMs?: number, agora?: () => number }} [o]
 *   max  = quantidade máxima de entradas (padrão 500)
 *   ttlMs = tempo de vida de cada entrada em ms (padrão 24h)
 *   agora = relógio (padrão Date.now). Use um falso em testes.
 */
function createCache(o = {}) {
  const max = o.max == null ? 500 : Number(o.max);
  const ttlMs = o.ttlMs == null ? 24 * 3600 * 1000 : Number(o.ttlMs);
  const agora = typeof o.agora === 'function' ? o.agora : Date.now;
  const mapa = new Map(); // chave -> { valor, criado }

  /** Chave do pedido: sha256 de { system, messages }. */
  function chave(req) {
    if (!req || typeof req !== 'object') {
      throw new Error('chave(req) exige um objeto com system e messages.');
    }
    const s = JSON.stringify({ system: req.system, messages: req.messages });
    return createHash('sha256').update(s).digest('hex');
  }

  function get(k) {
    const e = mapa.get(k);
    if (!e) return undefined;
    if (e.criado + ttlMs < agora()) {
      mapa.delete(k);
      return undefined;
    }
    // Marca como uso recente: remove e reinsere no fim (LRU).
    mapa.delete(k);
    mapa.set(k, e);
    return e.valor;
  }

  function set(k, valor) {
    if (mapa.has(k)) {
      mapa.delete(k);
    } else if (mapa.size >= max) {
      const primeira = mapa.keys().next().value;
      mapa.delete(primeira);
    }
    mapa.set(k, { valor, criado: agora() });
  }

  return { chave, get, set };
}

module.exports = { createCache };
