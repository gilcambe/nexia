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
      const authHeader = request.headers.get('x-nexia-cron') || '';
      const authBearer = request.headers.get('authorization') || '';
      const secret = String((this.env && this.env.NEXIA_CRON_SECRET) || '').trim();
      
      let isValid = false;
      if (secret && secret.length >= 32) {
        if (authHeader && authHeader === secret && authHeader.length >= 32) {
          isValid = true;
        } else if (authBearer.startsWith('Bearer ')) {
          const token = authBearer.substring(7).trim();
          if (token === secret && token.length >= 32) {
            isValid = true;
          }
        }
      }
      
      if (!isValid) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      const b = await request.json().catch(() => ({}));
      if (b.banco) this.bancosQuaseCheios.add(String(b.banco));
      return new Response(JSON.stringify({ ok: true, quaseCheios: Array.from(this.bancosQuaseCheios) }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (url.pathname === '/status') {
      return new Response(JSON.stringify({ quaseCheios: Array.from(this.bancosQuaseCheios) }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (url.pathname === '/vazao') {
      if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: { 'Content-Type': 'application/json' } });
      const body = await request.json().catch(() => ({}));
      const { banco, data, leituras = 0, escritas = 0, projectId = '' } = body || {};
      const bancoKey = String(banco || projectId || '').replace(/[^a-zA-Z0-9_-]/g, '');
      if (bancoKey && data && /^\d{4}-\d{2}-\d{2}$/.test(data)) {
        this.storage.put(`vazao:${bancoKey}:${data}`, JSON.stringify({ leituras: Number(leituras) || 0, escritas: Number(escritas) || 0 }));
      }
      return new Response(JSON.stringify({ ok: true, banco: bancoKey, leituras, escritas }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (url.pathname === '/vazao-get') {
      if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405, headers: { 'Content-Type': 'application/json' } });
      const entries = await this.storage.list({ prefix: 'vazao:' });
      const uso = {};
      for (const key of entries.keys) {
        const match = key.name.match(/^vazao:([a-zA-Z0-9_-]+):(\d{4}-\d{2}-\d{2})$/);
        if (match) {
          const banco = match[1];
          const data = match[2];
          const val = await this.storage.get(key.name);
          if (val) {
            const parsed = JSON.parse(val);
            if (!uso[banco]) uso[banco] = { data, leituras: 0, escritas: 0 };
            uso[banco].leituras += parsed.leituras;
            uso[banco].escritas += parsed.escritas;
          }
        }
      }
      return new Response(JSON.stringify({ ok: true, uso }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('Not Found', { status: 404 });
  }
}

export { VazaoController, CofreSql };

export default {
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname === '/api/corpo-ia') return corpoIa(request, env);
    if (new URL(request.url).pathname === '/api/cofre-sql') return pontaCofre(request, env);
    return cacheBorda.comCacheDeBorda(request, env, ctx,
      () => app.handleRequest(request, env, { getFunction: functions.getFunction }));
  },

  async scheduled(controller, env, ctx) {
    app.populateProcessEnv(env);
    const at = Number(controller && controller.scheduledTime) || Date.now();
    ctx.waitUntil(jobs.scheduledSweep({ env: process.env, now: () => at }).then(
      r => console.log('[nexia-cron]', JSON.stringify(r).slice(0, 500)),
      e => console.error('[nexia-cron]', e && e.message),
    ));
    ctx.waitUntil(lembretes.rodar(at).then(
      r => console.log('[bc-lembretes]', JSON.stringify(r)),
      e => console.error('[bc-lembretes]', e && e.message),
    ));
    ctx.waitUntil(lembretes.rodarSplash(at).then(
      r => console.log('[splash-lembretes]', JSON.stringify(r)),
      e => console.error('[splash-lembretes]', e && e.message),
    ));
    ctx.waitUntil(julesAuto.rodar(at).then(
      r => console.log('[jules-auto]', JSON.stringify(r)),
      e => console.error('[jules-auto]', e && e.message),
    ));
    ctx.waitUntil(saude.rodar(at).then(
      r => console.log('[saude-historico]', JSON.stringify(r)),
      e => console.error('[saude-historico]', e && e.message),
    ));
  },
};
