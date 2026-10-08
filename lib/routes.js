'use strict';
// Rotas compartilhadas pelo server.js (Node) e pelo Worker do Cloudflare (ADR-FREE-01).

// ─── API ROUTES → functions ───────────────────────────────────────
const API_ROUTES = {
  '/api/cortex':          'cortex-chat',
  '/api/body-coach-ai':   'body-coach-ai',
  '/api/body-coach-chat': 'body-coach-chat',
  '/api/ai-analysis':     'cortex-chat',
  '/api/auth':            'auth',
  '/api/memory':          'cortex-memory',
  '/api/rag':             'rag-engine',
  '/api/autodev':         'autodev-engine',
  '/api/models':          'multi-model-engine',
  '/api/swarm':           'swarm',
  '/api/agent-run':       'cortex-agent',
  '/api/agents':          'agents',
  '/api/actions':         'action-engine',
  '/api/logs':            'cortex-logs',
  '/api/events':          'event-processor',
  '/api/notifications':   'notifications',
  '/api/tenant':          'tenant-admin',
  '/api/crm':             'tenant-admin',
  '/api/usage':           'usage',
  '/api/billing':         'billing',
  '/api/observe':         'observability',
  '/api/observability':   'observability',
  '/api/learn':           'cortex-learn',
  '/api/pabx':            'pabx-handler',
  '/api/osint':           'osint-query',
  '/api/takedown':        'takedown-gen',
  '/api/payment':         'payment-engine',
  '/api/metrics':         'metrics-aggregator',
  '/api/architect':       'architect',
  '/api/whatsapp':        'whatsapp-business',
  '/api/nfe':             'nfe-engine',
  '/api/dynamic-pricing': 'dynamic-pricing',
  '/api/sentinel':        'sentinel-iot',
  '/api/sentinel-qa':     'sentinel',
  '/api/governance':      'middleware',
  '/api/tenant-domain':   'tenant-domain',
  '/api/dunning':         'dunning-scheduler',
  '/api/kpi':             'kpi-engine',
  '/api/churn':           'churn-predictor',
  '/api/sales':           'ai-sales-agent',
  '/api/financial':       'ai-financial',
  '/api/internal-agents': 'internal-agents',
  '/api/audit':           'audit-log',
  '/api/ads':             'ads-engine',
  '/api/recovery':        'account-recovery',
  '/api/strike':          'strike-engine',
  '/api/nexia':           'nexia-api',      // NEXIA AI (Fase 3): nexia-ai/api
};

// Pastas do repositório que podem ser servidas publicamente (além de out/)
const PUBLIC_DIRS = ['core', 'ces', 'bezsan', 'splash', 'viajante-pro'];

// Páginas HTML dos tenants (landings, admins e apps): caminho → [pasta, arquivo]
const TENANT_PAGES = {
  // Landings
  '/ces/landing':              ['ces', 'ces-landing.html'],
  '/bezsan/landing':           ['bezsan', 'bezsan-landing.html'],
  '/vp/landing':               ['viajante-pro', 'vp-landing.html'],
  '/viajante-pro/landing':     ['viajante-pro', 'vp-landing.html'],
  '/splash/landing':           ['splash', 'splash-landing.html'],
  // Admins
  '/ces/admin':                ['ces', 'ces-admin.html'],
  '/bezsan/admin':             ['bezsan', 'bezsan-admin.html'],
  '/vp/admin':                 ['viajante-pro', 'vp-admin.html'],
  '/viajante-pro/admin':       ['viajante-pro', 'vp-admin.html'],
  '/splash/admin':             ['splash', 'splash-admin.html'],
  // Apps especiais
  '/ces/checkin':              ['ces', 'checkin.html'],
  '/ces/executivo':            ['ces', 'ces-app-executivo.html'],
  '/vp/guia':                  ['viajante-pro', 'vp-guide.html'],
  '/vp/passageiro':            ['viajante-pro', 'vp-passenger.html'],
};

function resolveFunctionName(pathname) {
  if (API_ROUTES[pathname]) return API_ROUTES[pathname];
  for (const [route, fn] of Object.entries(API_ROUTES)) {
    if (pathname.startsWith(route + '/') || pathname.startsWith(route + '?')) return fn;
  }
  const m = pathname.match(/^\/.netlify\/functions\/([^/?]+)/);
  if (m) return m[1];
  return null;
}

module.exports = { API_ROUTES, PUBLIC_DIRS, TENANT_PAGES, resolveFunctionName };
