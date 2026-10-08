'use strict';
// ADR-FREE-01: lista fixa dos handlers para o bundle do Worker (o esbuild não segue require dinâmico).
// Cada módulo só é avaliado no primeiro pedido que o usa (menos CPU por pedido no plano grátis).
// O teste CF4 confere que esta lista bate com netlify/functions/.
const LOADERS = {
  'account-recovery': () => require('../netlify/functions/account-recovery.js'),
  'action-engine': () => require('../netlify/functions/action-engine.js'),
  'ads-engine': () => require('../netlify/functions/ads-engine.js'),
  'agents': () => require('../netlify/functions/agents.js'),
  'ai-financial': () => require('../netlify/functions/ai-financial.js'),
  'ai-sales-agent': () => require('../netlify/functions/ai-sales-agent.js'),
  'architect': () => require('../netlify/functions/architect.js'),
  'audit-log': () => require('../netlify/functions/audit-log.js'),
  'auth': () => require('../netlify/functions/auth.js'),
  'autodev-engine': () => require('../netlify/functions/autodev-engine.js'),
  'billing': () => require('../netlify/functions/billing.js'),
  'body-coach-ai': () => require('../netlify/functions/body-coach-ai.js'),
  'body-coach-chat': () => require('../netlify/functions/body-coach-chat.js'),
  'churn-predictor': () => require('../netlify/functions/churn-predictor.js'),
  'cortex-agent': () => require('../netlify/functions/cortex-agent.js'),
  'cortex-chat': () => require('../netlify/functions/cortex-chat.js'),
  'cortex-learn': () => require('../netlify/functions/cortex-learn.js'),
  'cortex-logs': () => require('../netlify/functions/cortex-logs.js'),
  'cortex-memory': () => require('../netlify/functions/cortex-memory.js'),
  'dunning-scheduler': () => require('../netlify/functions/dunning-scheduler.js'),
  'dynamic-pricing': () => require('../netlify/functions/dynamic-pricing.js'),
  'event-processor': () => require('../netlify/functions/event-processor.js'),
  'internal-agents': () => require('../netlify/functions/internal-agents.js'),
  'leads': () => require('../netlify/functions/leads.js'),
  'kpi-engine': () => require('../netlify/functions/kpi-engine.js'),
  'metrics-aggregator': () => require('../netlify/functions/metrics-aggregator.js'),
  'multi-model-engine': () => require('../netlify/functions/multi-model-engine.js'),
  'nfe-engine': () => require('../netlify/functions/nfe-engine.js'),
  'notifications': () => require('../netlify/functions/notifications.js'),
  'observability': () => require('../netlify/functions/observability.js'),
  'osint-query': () => require('../netlify/functions/osint-query.js'),
  'pabx-handler': () => require('../netlify/functions/pabx-handler.js'),
  'payment-engine': () => require('../netlify/functions/payment-engine.js'),
  'rag-engine': () => require('../netlify/functions/rag-engine.js'),
  'sentinel-iot': () => require('../netlify/functions/sentinel-iot.js'),
  'sentinel': () => require('../netlify/functions/sentinel.js'),
  'strike-engine': () => require('../netlify/functions/strike-engine.js'),
  'swarm': () => require('../netlify/functions/swarm.js'),
  'takedown-gen': () => require('../netlify/functions/takedown-gen.js'),
  'tenant-admin': () => require('../netlify/functions/tenant-admin.js'),
  'tenant-domain': () => require('../netlify/functions/tenant-domain.js'),
  'usage': () => require('../netlify/functions/usage.js'),
  'whatsapp-business': () => require('../netlify/functions/whatsapp-business.js'),
  'nexia-api': () => require('../nexia-ai/api/index.js'),
};

const loaded = new Map();

/** Handler no formato Netlify, ou null se não existe ou falhou ao carregar (como no server.js). */
function getFunction(name) {
  if (!Object.prototype.hasOwnProperty.call(LOADERS, name)) return null;
  if (!loaded.has(name)) {
    try { loaded.set(name, LOADERS[name]()); }
    catch (e) { console.warn('[FN] ✗', name, '-', e && e.message); loaded.set(name, null); }
  }
  return loaded.get(name);
}

module.exports = { LOADERS, getFunction };
