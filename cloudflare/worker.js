// NEXIA — Cloudflare Worker no plano grátis (ADR-FREE-01, substitui o Container do ADR-HOST-01).
// O próprio Worker atende o site (binding ASSETS) e a API (/api/*), com o mesmo código do server.js.
// Tarefas longas (execuções de agentes, onboarding, retomada) vão para o GitHub Actions (ADR-FREE-02).
import app from './app.js';
import functions from './functions.js';
import jobs from '../nexia-ai/jobs/index.js';
import { corpoIa } from './corpoIa.js';

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/api/corpo-ia') return corpoIa(request, env);
    return app.handleRequest(request, env, { getFunction: functions.getFunction });
  },

  // ADR-F12-03 + ADR-FREE-02 + ADR-AUTO-01: a cada 5 min procura Robôs NEXIA vencidos e, de hora
  // em hora, execuções paradas; havendo algo, dispara a tarefa no GitHub Actions (sem processo
  // longo dentro do Worker). Sem nada vencido, não dispara nada.
  async scheduled(controller, env, ctx) {
    app.populateProcessEnv(env);
    const at = Number(controller && controller.scheduledTime) || Date.now();
    ctx.waitUntil(jobs.scheduledSweep({ env: process.env, now: () => at }).then(
      r => console.log('[nexia-cron]', JSON.stringify(r).slice(0, 500)),
      e => console.error('[nexia-cron]', e && e.message),
    ));
  },
};
