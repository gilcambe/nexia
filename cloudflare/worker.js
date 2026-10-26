// NEXIA — Cloudflare Worker no plano grátis (ADR-FREE-01, substitui o Container do ADR-HOST-01).
// O próprio Worker atende o site (binding ASSETS) e a API (/api/*), com o mesmo código do server.js.
// Tarefas longas (execuções de agentes, onboarding, retomada) vão para o GitHub Actions (ADR-FREE-02).
import app from './app.js';
import functions from './functions.js';
import jobs from '../nexia-ai/jobs/index.js';
import { corpoIa } from './corpoIa.js';
import lembretes from './lembretes.js';
import saude from './saude.js';
import julesAuto from './jules-auto.js';
import cacheBorda from './cacheBorda.js';
import { VazaoController } from '../src/durable/VazaoController.js';
import { ChatDurableObject } from '../src/worker.js';

// #1662: o Cloudflare só publica se a classe do Durable Object sair do arquivo de entrada.
export { VazaoController, ChatDurableObject };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // 1. Chat e SSE -> Durable Object (fila com posição e tempo estimado)
    if (
      url.pathname.startsWith('/api/chat') ||
      url.pathname.startsWith('/api/sse') ||
      url.pathname.startsWith('/chat') ||
      url.pathname.startsWith('/sse')
    ) {
      try {
        const id = env.CHAT_DO.idFromName('chat-fila');
        const stub = env.CHAT_DO.get(id);
        return stub.fetch(request);
      } catch {
        // Se CHAT_DO não estiver configurado, segue para fluxo normal
      }
    }
    
    // 2. Rotas específicas existentes
    if (url.pathname === '/api/corpo-ia') return corpoIa(request, env);
    
    // 3. Rotas da API existentes (preservadas)
    // /api/cortex, /api/pedidos, /api/central, etc. seguem para os handlers do Netlify/Cloudflare
    const response = await functions.getFunction(request, env);
    if (response && response.status !== 404) {
      return response;
    }
    
    // #807: leituras públicas (config do Firebase etc.) passam pelo cache de borda (60 a 300 s)
    return cacheBorda.comCacheDeBorda(request, env, ctx,
      () => app.handleRequest(request, env, { getFunction: functions.getFunction }));
  }

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
    // Body Coach: lembretes no celular (treino, água) de quem tem lembrete neste bloco de 5 min.
    ctx.waitUntil(lembretes.rodar(at).then(
      r => console.log('[bc-lembretes]', JSON.stringify(r)),
      e => console.error('[bc-lembretes]', e && e.message),
    ));
    // Splash: lembretes de cliente (saldo e véspera da festa) avisam a dona no celular às 9h.
    ctx.waitUntil(lembretes.rodarSplash(at).then(
      r => console.log('[splash-lembretes]', JSON.stringify(r)),
      e => console.error('[splash-lembretes]', e && e.message),
    ));
    // Cortex: escada para tarefa travada (Jules grátis, volta ao Cortex, por fim humano), a cada 15 min.
    ctx.waitUntil(julesAuto.rodar(at).then(
      r => console.log('[jules-auto]', JSON.stringify(r)),
      e => console.error('[jules-auto]', e && e.message),
    ));
    // Central: histórico de saúde (1 amostra por hora por rota pública, 30 dias).
    ctx.waitUntil(saude.rodar(at).then(
      r => console.log('[saude-historico]', JSON.stringify(r)),
      e => console.error('[saude-historico]', e && e.message),
    ));
  },
};
