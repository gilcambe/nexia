'use strict';

/**
 * Utilitário de cache em memória para o firebase-lite / D1-backend.
 * Oferece get(key) e set(key, value, ttl).
 */
function createCache({ agora = () => Date.now() } = {}) {
  const store = new Map(); // key -> { value, expiresAt }
  let hits = 0;
  let misses = 0;

  return {
    get(key) {
      const item = store.get(key);
      if (!item) {
        misses++;
        return null;
      }
      if (item.expiresAt <= agora()) {
        store.delete(key);
        misses++;
        return null;
      }
      hits++;
      return item.value;
    },
    set(key, value, ttl = 60000) {
      const expiresAt = agora() + Number(ttl);
      store.set(key, { value, expiresAt });
    },
    clear() {
      store.clear();
      hits = 0;
      misses = 0;
    },
    stats() {
      return {
        hits,
        misses,
        size: store.size
      };
    }
  };
}

let sharedCache = null;
function getSharedCache() {
  if (!sharedCache) {
    sharedCache = createCache();
  }
  return sharedCache;
}

module.exports = {
  createCache,
  getSharedCache
};
