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
import { CofreSql, pontaCofre } from '../src/durable/CofreSql.js';

// #1662: o Cloudflare só publica se a classe do Durable Object sair do arquivo de entrada.
// #2221: VazaoController durable object para controle e rodízio de cotas do Vault
export class VazaoController {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.storage = state.storage;
    this.bancosQuaseCheios = new Set();
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/marcar-cheio') {
      const authHeader = request.headers.get('x-nexia-cron') || request.headers.get('authorization') || '';
      const secret = String((this.env && this.env.NEXIA_CRON_SECRET) || '');
      if (secret.length >= 32 && authHeader !== secret && authHeader !== `Bearer ${secret}`) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      const b = await request.json().catch(() => ({}));
      if (b.banco) this.bancosQuaseCheios.add(b.banco);
      return new Response(JSON.stringify({ ok: true, quaseCheios: Array.from(this.bancosQuaseCheios) }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (url.pathname === '/status') {
      return new Response(JSON.stringify({ quaseCheios: Array.from(this.bancosQuaseCheios) }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('Not Found', { status: 404 });
  }
}

export { VazaoController, CofreSql };

export default {
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname === '/api/corpo-ia') return corpoIa(request, env);
    // #2188: jobs do GitHub Actions usam o banco do Worker do cofre por esta rota (com segredo).
    if (new URL(request.url).pathname === '/api/cofre-sql') return pontaCofre(request, env);
    // #807: leituras públicas (config do Firebase etc.) passam pelo cache de borda (60 a 300 s).
    return cacheBorda.comCacheDeBorda(request, env, ctx,
      () => app.handleRequest(request, env, { getFunction: functions.getFunction }));
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
