'use strict';
// Cache em memória para evitar chamadas repetidas ao provedor de IA.
// Usa Map com ordem de uso (LRU) e TTL.
const crypto = require('crypto');

/**
 * Cria um cache em memória.
 * @param {{ max?: number, ttlMs?: number, agora?: () => number }} [o]
 *   max - máximo de itens no cache (default 500)
 *   ttlMs - tempo de vida de cada item em ms (default 24h)
 *   agora - função para obter o timestamp atual (default Date.now)
 */
function createCache(o = {}) {
  const max = o.max || 500;
  const ttlMs = o.ttlMs || 24 * 3600e3;
  const agora = o.agora || Date.now;

  // Map ordenado por ordem de uso (mais recente primeiro)
  // As chaves são strings (SHA-256 hashes)
  const map = new Map();

  /**
   * Gera a chave do cache a partir da requisição.
   * A chave é o SHA-256 de JSON.stringify({ system, messages }).
   * @param {{ system?: string, messages?: Array<{ role: string, content?: string }> }} req
   * @returns {string}
   */
  function chave(req) {
    const payload = JSON.stringify({
      system: req.system || '',
      messages: req.messages || [],
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Remove o item mais antigo quando o cache está cheio.
   */
  function evict() {
    if (map.size >= max) {
      // O primeiro item é o mais antigo (menos recente)
      map.delete(map.keys().next().value);
    }
  }

  /**
   * Obtém um item do cache.
   * @param {string} k - chave do item
   * @returns {{ valor: any, expirou: boolean } | undefined}
   */
  function get(k) {
    const item = map.get(k);
    if (!item) return undefined;
    const expirou = item.expireAt < agora();
    if (expirou) {
      map.delete(k);
      return undefined;
    }
    // Mover para o final (mais recente)
    map.delete(k);
    map.set(k, item);
    return { valor: item.valor, expirou: false };
  }

  /**
   * Define um item no cache.
   * @param {string} k - chave do item
   * @param {any} valor - valor a ser armazenado
   */
  function set(k, valor) {
    const expireAt = agora() + ttlMs;
    map.set(k, { valor, expireAt });
    evict();
  }

  /**
   * Remove um item do cache.
   * @param {string} k - chave do item
   */
  function del(k) {
    map.delete(k);
  }

  /**
   * Limpa todo o cache.
   */
  function clear() {
    map.clear();
  }

  return {
    chave,
    get,
    set,
    del,
    clear,
    size: () => map.size,
  };
}

module.exports = { createCache };
