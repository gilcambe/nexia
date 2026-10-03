// NEXIA — Worker do Cloudflare (ADR-HOST-01). Recebe todo o tráfego do domínio e repassa ao
// container que roda o server.js de sempre (site React em out/, páginas estáticas e /api/*).
// Uma instância só ("nexia"): o server.js guarda estado em memória (rate limit, execuções em andamento).
import { Container, getContainer } from '@cloudflare/containers';
import { containerEnv, cronRequest } from './env.js';

export class NexiaBackend extends Container {
  defaultPort = 8080;
  sleepAfter = '30m';

  constructor(ctx, env) {
    super(ctx, env);
    this.envVars = containerEnv(env);
  }
}

export default {
  async fetch(request, env) {
    return getContainer(env.NEXIA_BACKEND, 'nexia').fetch(request);
  },

  // ADR-F12-03: retomada agendada de execuções paradas (Cron Trigger em wrangler.jsonc).
  // Sem NEXIA_CRON_SECRET (segredo do Worker) não faz nada.
  async scheduled(controller, env, ctx) {
    const req = cronRequest(env);
    if (!req) return;
    ctx.waitUntil(getContainer(env.NEXIA_BACKEND, 'nexia').fetch(req).then(async r => {
      if (!r.ok) console.error('[nexia-cron] sweep', r.status);
      else console.log('[nexia-cron] sweep', JSON.stringify(await r.json()).slice(0, 500));
    }));
  },
};
