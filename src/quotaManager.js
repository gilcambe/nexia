/**
 * Gerenciador de cotas persistente usando Cloudflare D1.
 */
export class QuotaManager {
  constructor(d1Database) {
    this.db = d1Database;
  }

  async getQuota(provider, model, account = 'default') {
    if (!this.db) return { count: 0, limit: 1000, resetAt: 0, locked: false };
    const key = `${provider}:${model}:${account}`;
    try {
      const row = await this.db.prepare(
        "SELECT count, limit_val, reset_at, locked FROM quotas WHERE id = ?"
      ).bind(key).first();

      if (!row) {
        return { count: 0, limit: 1000, resetAt: 0, locked: false };
      }

      const now = Date.now();
      if (row.reset_at && now > row.reset_at) {
        return { count: 0, limit: row.limit_val || 1000, resetAt: row.reset_at, locked: false };
      }

      return {
        count: row.count,
        limit: row.limit_val,
        resetAt: row.reset_at,
        locked: Boolean(row.locked)
      };
    } catch (err) {
      console.error("Erro em getQuota:", err);
      return { count: 0, limit: 1000, resetAt: 0, locked: false };
    }
  }

  async incrementUsage(provider, model, account = 'default', amount = 1, resetAt = 0, limit = 1000) {
    if (!this.db) return;
    const key = `${provider}:${model}:${account}`;
    try {
      await this.db.prepare(`
        INSERT INTO quotas (id, count, limit_val, reset_at, locked)
        VALUES (?, ?, ?, ?, 0)
        ON CONFLICT(id) DO UPDATE SET
          count = count + ?,
          limit_val = ?,
          reset_at = CASE WHEN ? > 0 THEN ? else reset_at END,
          locked = CASE WHEN (count + ?) >= ? THEN 1 else locked END
      `).bind(key, amount, limit, resetAt, amount, limit, resetAt, resetAt, amount, limit).run();
    } catch (err) {
      console.error("Erro em incrementUsage:", err);
    }
  }

  async resetQuota(provider, model, account = 'default') {
    if (!this.db) return;
    const key = `${provider}:${model}:${account}`;
    try {
      await this.db.prepare(
        "UPDATE quotas SET count = 0, locked = 0, reset_at = 0 WHERE id = ?"
      ).bind(key).run();
    } catch (err) {
      console.error("Erro em resetQuota:", err);
    }
  }

  async isCircuitBroken(provider, model, account = 'default') {
    const quota = await this.getQuota(provider, model, account);
    if (quota.locked) return true;
    if (quota.limit > 0 && quota.count >= quota.limit) return true;
    return false;
  }
}
