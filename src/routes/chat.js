/**
 * Rotas de chat do Cloudflare Worker.
 * Preserva o encaminhamento para os handlers existentes (Netlify Functions / Cloudflare)
 * e expõe o roteador de chat/SSE usado pelo worker principal.
 */

const API_BASE = env.NEXIA_APP_URL || 'https://api.nexia.example';

const existingRoutes = [
  '/api/cortex',
  '/api/pedidos',
  '/api/central',
  '/api/leads',
  '/api/conheca',
  '/api/agenda',
  '/api/locacao',
  '/api/nutri',
  '/api/instagram-dm',
  '/api/leilao',
  '/api/ai-analysis',
  '/api/auth',
  '/api/memory',
  '/api/rag',
  '/api/autodev',
  '/api/models',
  '/api/swarm',
  '/api/agent-run',
  '/api/agents',
  '/api/actions',
  '/api/logs',
  '/api/events',
  '/api/notifications',
  '/api/tenant',
  '/api/crm',
  '/api/usage',
  '/api/billing',
  '/api/observe',
  '/api/observability',
  '/api/learn',
  '/api/pabx',
  '/api/osint',
  '/api/takedown',
  '/api/payment',
  '/api/metrics',
  '/api/architect',
  '/api/whatsapp',
  '/api/nfe',
  '/api/dynamic-pricing',
  '/api/sentinel',
  '/api/sentinel-qa',
  '/api/governance',
  '/api/tenant-domain',
  '/api/dunning',
  '/api/kpi',
  '/api/churn',
  '/api/sales',
  '/api/financial',
  '/api/internal-agents',
  '/api/audit',
  '/api/ads',
  '/api/recovery',
  '/api/strike',
  '/api/nexia',
];

export function chatRoutes(request, env, ctx) {
  const url = new URL(request.url);

  // Se a rota for uma das existentes, repassa para o handler correspondente
  // (mantido para não quebrar rotas já em produção)
  for (const route of existingRoutes) {
    if (url.pathname === route || url.pathname.startsWith(route + '/')) {
      return forwardToHandler(route, request, env);
    }
  }

  return new Response('Not found', { status: 404 });
}

async function forwardToHandler(route, request, env) {
  // Adicionar autenticação básica para rotas existentes
  if (!request.headers.get('Authorization')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const target = `${API_BASE}${route}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    const response = await fetch(target, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Erro ao encaminhar rota existente', details: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
