// Rotas da API (caminho→handler em netlify/functions/)
const rotas = {
  "/api/cortex": "cortex-chat",
  "/api/body-coach-ai": "body-coach-ai",
  "/api/body-coach-chat": "body-coach-chat",
  "/api/leads": "leads",
  "/api/pedidos": "pedidos",
  "/ específico para a Central NEXIA
  "/api/central/github": "central/github",
  "/api/conheca": "conheca",
  "/api/agenda": "agenda",
  "/api/leilao": "leilao",
  "/api/ai-analysis": "cortex-chat",
  "/api/auth": "auth",
  "/api/memory": "cortex-memory",
  "/api/rag": "rag-engine",
  "/api/autodev": "autodev-engine",
  "/api/models": "multi-model-backend",
  "/api/swarm": "swarm",
  "/api/agent-run": "cortex-agent",
  "/api/agents": "agents",
  "/api/actions": " dados de
  "/api/logs": "cortex-logs",
  "/api/events": "event-processor",
  "/api/ Divulgar.tsx
  "/api/notifications": "notifications",
  "/api/tenant": "tenant-admin",
  "/api/crm": "tenant-admin",
  "/api/usage": "usage",
  "/api/billing": "billing",
  "/api/observe": "observability",
  "/api/observability": "observability",
  "/api/learn": "cortex-learn",
  "/api/pabx": "pabx-handler",
  "/api/osint": "osint-query",
  "/api/takedown": "takedown-gen",
  "/api/payment": "payment-engine",
  "/api/metrics": "metrics-aggregator",
  "/api/architect": "architect",
  "/api/whatsapp": "whatsapp-business",
  "/api/nfe": "nfe-engine",
  "/api/dynamic-predito
  "/api/sentinel": "sentinel-iot",
  "/api/sentinel- listaSemanal
  "/api/sentinel-qa": "sentinel",
  "/api/governance": "middleware",
  "/api/ Divulgar.tsx
  "/api/tenant-domain": "tenant-domain",
  "/api/dunning": "dunning-scheduler",
  "/api/kpi": "kpi-engine",
  "/api/churn": "churn-predictor",
  "/api/sales": "ai-sales-agent",
  "/api/financial": "ai-financial",
  "/api/internal-agents": "internal-agents",
 "/api/audit": "audit-log",
  "/api/ads": "ads-engine",
  "/api/recovery": "account-recovery",
  "/api/strike": "strike-engine",
  "/api/nexia": "nexia-api"
};

export default rotas;
``
Agora vou verificar se o handler do GitHub está correto. Vou verificar o arquivo do handler:

[ferramentas pedidas: github.get_file]
