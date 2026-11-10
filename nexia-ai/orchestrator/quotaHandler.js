import { QuotaManager } from '../../src/quotaManager.js';

export async function checkAndHandleQuota(d1, provider, model, account = 'default') {
  const manager = new QuotaManager(d1);
  const broken = await manager.isCircuitBroken(provider, model, account);
  if (broken) {
    const err = new Error("Limite de cota atingido (waiting_quota)");
    err.code = "waiting_quota";
    throw err;
  }
  return manager;
}

export async function recordApiUsage(d1, provider, model, account = 'default', headers = {}, cost = 1) {
  const manager = new QuotaManager(d1);
  
  let resetAt = 0;
  if (headers) {
    const retryAfter = headers.get ? headers.get('retry-after') : headers['retry-after'];
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        resetAt = Date.now() + seconds * 1000;
      }
    }
  }

  await manager.incrementUsage(provider, model, account, cost, resetAt);
}
