'use strict';

const { createHash } = require('node:crypto');

/** Cache no D1 para respostas sem ferramentas. */
function createD1Cache({ d1, tableName = 'router_cache', ttlDays = 7 } = {}) {
  if (!d1) throw new Error('D1 database required');

  return {
  if (!d1) throw new Error('D1 database required');

  return {
    async get(k) {
      const now = new Date();
      const result = await d1.prepare(`SELECT valor FROM ${tableName} WHERE chave = ? AND expires_at > ?`).bind(k, now.toISOString()).first();
      return result ? JSON.parse(result.valor) : undefined;
    },
    async set(k, valor) {
      const expiresAt = new Date(Date.now() + ttlDays * 24 * 3600e3).toISOString();
      await d1.prepare(`INSERT OR REPLACE INTO ${tableName} (chave, valor, expires_at) VALUES (?, ?, ?)`).bind(k, JSON.stringify(valor), expiresAt).run();
    }
  };
}
  if (!d1) throw new Error('D1 database required');

  return {
    async get(k) {
      const now = new Date();
      const result = await d1.prepare(`SELECT valor FROM ${tableName} WHERE chave = ? AND expires_at > ?`).bind(k, now.toISOString()).first();
      return result ? JSON.parse(result.valor) : undefined;
    },
    async set(k, valor) {
      const expiresAt = new Date(Date.now() + ttlDays * 24 * 3600e3).toISOString();
      await d1.prepare(`INSERT OR REPLACE INTO ${tableName} (chave, valor, expires_at) VALUES (?, ?, ?)`).bind(k, JSON.stringify(valor), expiresAt).run();
    }
  };
}

module.exports = { createD1Cache };
