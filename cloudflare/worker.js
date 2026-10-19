// NEXIA — Cloudflare Worker no plano grátis (ADR-FREE-01, substitui o Container do ADR-HOST-01).
// O próprio Worker atende o site (binding ASSETS) e a API (/api/*), com o mesmo código do server.js.
// Tarefas longas (execuções de agentes, onboarding, retomada) vão para o GitHub Actions (ADR-FREE-02).
import app from './app.js';
import functions from './functions.js';
import jobs from '../nexia-ai/jobs/index.js';
import { corpoIa } from './corpoIa.js';
import lembretes from './lembretes.js';
import saude from './saude.js';

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/api/corpo-ia') return corpoIa(request, env);
    
    // Cache de borda para APIs de leitura (Cache API do Worker) - CORRIGIDO SEGURANCA
    const url = new URL(request.url);
    if (request.method === 'GET') {
      // APIs com cache (excluindo rotas sensíveis)
      const cacheablePaths = [
        '/api/ofertas',
        '/api/catalogos'
      ];
      
      if (cacheablePaths.some(path => url.pathname.startsWith(path))) {
        // Verifica se a requisição é autenticada (evita expor dados privados)
        const authHeader = request.headers.get('Authorization');
        const sessionId = request.headers.get('X-Session-ID') || request.cookies?.get('session-id');
        
        // Se não tem autenticação e a rota pode ser sensível, não cacheia
        if (!authHeader && !sessionId) {
          return app.handleRequest(request, env, { getFunction: functions.getFunction });
        }
        
        const cache = caches.default;
        const cacheKey = new Request(request.url, request);
        
        // Tenta buscar do cache
        const cachedResponse = await cache.match(cacheKey);
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Se não está no cache, executa a requisição original
        const response = await app.handleRequest(request, env, { getFunction: functions.getFunction });
        
        // Não cacheia respostas de erro (4xx/5xx)
        if (response.status >= 400) {
          return response;
        }
        
        // TTL fixo por tipo de rota (evita aleatoriedade)
        let ttl;
        if (url.pathname.startsWith('/api/ofertas')) {
          ttl = 120; // 2 minutos para ofertas (mudam com frequência)
        } else if (url.pathname.startsWith('/api/catalogos')) {
          ttl = 300; // 5 minutos para catálogos (estáticos)
        } else {
          ttl = 60; // fallback: 1 minuto
        }
        
        const cacheResponse = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: {
            'Content-Type': response.headers.get('Content-Type'),
            'Cache-Control': `public, max-age=${ttl}`,
            'X-Cache': 'MISS'
          }
        });
        
        ctx.waitUntil(cache.put(cacheKey, cacheResponse.clone()));
        return cacheResponse;
      }
    }
    
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
    // Body Coach: lembretes no celular (treino, água) de quem tem lembrete neste bloco de 5 min.
    ctx.waitUntil(lembretes.rodar(at).then(
      r => console.log('[bc-lembretes]', JSON.stringify(r)),
      e => console.error('[bc-lembretes]', e && e.message),
    ));
    // Central: histórico de saúde (1 amostra por hora por rota pública, 30 dias).
    ctx.waitUntil(saude.rodar(at).then(
      r => console.log('[saude-historico]', JSON.stringify(r)),
      e => console.error('[saude-historico]', e && e.message),
    ));
  },
};
