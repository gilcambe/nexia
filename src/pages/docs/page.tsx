import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const steps = [
  { id: "env", title: "1. Pré-requisitos", icon: "ri-download-cloud-line", content: ["Node.js 20+ e npm/yarn", "Git configurado", "Docker Engine 24+ e Docker Compose v2+", "VPS com 4GB RAM (8GB para Ollama)", "Portas 3001, 6379, 11434 liberadas"] },
  { id: "clone", title: "2. Clone e Instalação", icon: "ri-git-branch-line", content: ["git clone https://github.com/seu-usuario/nexia-os.git", "cd nexia-os", "npm install", "npm run dev"] },
  { id: "docker", title: "3. Docker Compose", icon: "ri-ship-line", content: ["Crie docker-compose.yml na raiz", "Configure .env com REDIS_URL, JWT_SECRET, S3 credenciais", "docker compose up -d", "docker compose ps", "docker compose logs -f api-gateway"] },
  { id: "redis", title: "4. Redis + BullMQ", icon: "ri-database-2-line", content: ["Redis sobe automaticamente via Docker Compose", "BullMQ gerencia 4 filas: analyze, test, fix, deploy", "Monitoramento: redis-cli MONITOR", "Workers com retry e backoff exponencial"] },
  { id: "ollama", title: "5. Ollama (IA Local)", icon: "ri-robot-2-line", content: ["docker compose exec ollama ollama pull mistral", "Ollama expõe API REST em http://localhost:11434", "Endpoint: POST /api/generate", "Mistral 7B processa ~2.1M tokens/min"] },
  { id: "workers", title: "6. Worker Pool", icon: "ri-cpu-line", content: ["4 workers Node.js paralelos", "Consomem jobs da fila Redis", "Sobem containers Docker Sandbox", "Playwright, k6 e ZAP rodam no container"] },
  { id: "frontend", title: "7. Deploy do Frontend", icon: "ri-reactjs-line", content: ["npm run build", "Deploy no Render: conecte o repo GitHub", "Configure VITE_NEXIA_API_URL apontando para backend", "node server.js serve o build com SPA fallback"] },
  { id: "test", title: "8. Testar o Pipeline", icon: "ri-test-tube-line", content: ["curl -X POST /api/sentinel-qa -d '{\"mode\":\"scan\"}'", "Acompanhe em /qa-center no frontend", "Logs em tempo real via SSE", "Relatório JSON disponível via /api/logs"] },
];

const envVars = [
  { var: "NODE_ENV", desc: "Ambiente de execução", example: "production" },
  { var: "PORT", desc: "Porta do servidor", example: "3001" },
  { var: "REDIS_URL", desc: "URL do Redis", example: "redis://localhost:6379" },
  { var: "JWT_SECRET", desc: "Chave para tokens JWT", example: "super-secret-key-123" },
  { var: "OLLAMA_URL", desc: "URL do Ollama", example: "http://localhost:11434" },
  { var: "VITE_NEXIA_API_URL", desc: "URL do backend NEXIA_OS", example: "https://nexia-os.onrender.com" },
  { var: "GITHUB_TOKEN", desc: "Token para repos privados", example: "ghp_..." },
];

export default function DocsPage() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  const copyEnv = useCallback((variable: string) => {
    navigator.clipboard.writeText(variable + "=").then(() => {
      setCopiedVar(variable);
      setTimeout(() => setCopiedVar(null), 1500);
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-display antialiased">
      <header className="border-b border-nexia-border bg-[#0a0a0f]">
        <div className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm text-nexia-muted hover:text-white transition-colors cursor-pointer">
              <div className="w-7 h-7 flex items-center justify-center rounded-md bg-nexia-cyan/20"><i className="ri-arrow-left-line text-nexia-cyan text-sm" /></div>
              Voltar ao site
            </button>
            <div className="flex items-center gap-3">
              <button onClick={() => navigate("/sentinel")} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-nexia-cyan bg-nexia-cyan/10 border border-nexia-cyan/20 rounded-lg hover:bg-nexia-cyan/15 transition-colors cursor-pointer whitespace-nowrap"><i className="ri-shield-keyhole-line" /> Sentinel QA</button>
              <button onClick={() => navigate("/pipeline")} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-nexia-cyan bg-nexia-cyan/10 border border-nexia-cyan/20 rounded-lg hover:bg-nexia-cyan/15 transition-colors cursor-pointer whitespace-nowrap"><i className="ri-node-tree" /> Pipeline</button>
              <button onClick={() => navigate("/codigo")} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-nexia-cyan bg-nexia-cyan/10 border border-nexia-cyan/20 rounded-lg hover:bg-nexia-cyan/15 transition-colors cursor-pointer whitespace-nowrap"><i className="ri-code-box-line" /> Código</button>
            </div>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-nexia-cyan/10 border border-nexia-cyan/20"><i className="ri-book-open-line text-nexia-cyan text-xl" /></div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Documentação de Deploy</h1>
          </div>
          <p className="text-sm md:text-base text-nexia-muted max-w-lg">Guia completo para deployar o ecossistema NEXIA OS — frontend, backend, Docker, Redis, BullMQ e Ollama.</p>
        </div>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
        {/* Steps */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-5"><i className="ri-list-check text-nexia-cyan" /><h2 className="text-lg font-semibold text-white">Passo a Passo</h2></div>
          <div className="flex flex-col gap-3">
            {steps.map((step) => {
              const isOpen = activeStep === step.id;
              return (
                <div key={step.id} className="rounded-xl bg-nexia-surface border border-nexia-border overflow-hidden">
                  <button onClick={() => setActiveStep(isOpen ? null : step.id)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.02] transition-colors cursor-pointer">
                    <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-nexia-cyan/10 border border-nexia-cyan/20 flex-shrink-0"><i className={`${step.icon} text-nexia-cyan text-sm`} /></span>
                    <span className="text-sm font-semibold text-white flex-1">{step.title}</span>
                    <i className={isOpen ? "ri-arrow-up-s-line text-nexia-muted" : "ri-arrow-down-s-line text-nexia-muted"} />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pl-14">
                      <ul className="flex flex-col gap-2">
                        {step.content.map((line, i) => (
                          <li key={i} className="flex items-start gap-2"><span className="w-1 h-1 rounded-full bg-nexia-cyan mt-2 flex-shrink-0" /><span className="text-xs text-nexia-muted leading-relaxed font-mono">{line}</span></li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Env Vars */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-5"><i className="ri-settings-3-line text-nexia-cyan" /><h2 className="text-lg font-semibold text-white">Variáveis de Ambiente</h2></div>
          <div className="rounded-xl bg-nexia-surface border border-nexia-border overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-nexia-border text-nexia-muted text-xs uppercase"><th className="px-4 py-3">Variável</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">Exemplo</th><th className="px-4 py-3 text-right" /></tr></thead>
              <tbody>
                {envVars.map((env) => (
                  <tr key={env.var} className="border-b border-nexia-border/50 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3"><code className="text-xs text-nexia-cyan font-mono">{env.var}</code></td>
                    <td className="px-4 py-3 text-xs text-nexia-muted">{env.desc}</td>
                    <td className="px-4 py-3 text-xs text-nexia-muted font-mono">{env.example}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => copyEnv(env.var)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-nexia-muted hover:text-white hover:bg-white/5 transition-colors cursor-pointer whitespace-nowrap">
                        <i className={copiedVar === env.var ? "ri-check-line text-emerald-400" : "ri-file-copy-line"} />
                        {copiedVar === env.var ? "Copiado" : "Copiar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Docker Compose */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-5"><i className="ri-ship-line text-nexia-cyan" /><h2 className="text-lg font-semibold text-white">Docker Compose — Referência Rápida</h2></div>
          <div className="rounded-xl bg-nexia-surface border border-nexia-border overflow-hidden">
            <div className="flex items-center px-4 py-2.5 bg-nexia-surface2 border-b border-nexia-border"><span className="text-xs text-nexia-muted font-mono">docker-compose.yml</span></div>
            <pre className="p-4 font-mono text-[11px] leading-relaxed text-nexia-muted overflow-x-auto"><code>{`version: '3.8'
services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports: ['6379:6379']
  api-gateway:
    image: node:20-alpine
    ports: ['3001:3001']
    env_file: [.env]
  worker:
    image: node:20-alpine
    env_file: [.env]
    deploy: { replicas: 4 }
  ollama:
    image: ollama/ollama:latest
    ports: ['11434:11434']`}</code></pre>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center py-8">
          <h3 className="text-xl font-bold text-white mb-3">Pronto para levar o NEXIA OS para produção?</h3>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button onClick={() => navigate("/codigo")} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-nexia-cyan text-[#0a0a0f] text-sm font-semibold hover:bg-nexia-cyan-dim transition-all cursor-pointer whitespace-nowrap"><i className="ri-code-box-line" /> Ver Código-Fonte</button>
            <a href="https://wa.me/5511944037259?text=Quero%20deployar%20a%20NEXIA%20OS!" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-nexia-border text-nexia-muted text-sm hover:text-white hover:border-nexia-cyan/40 transition-all whitespace-nowrap"><i className="ri-whatsapp-fill" /> Suporte via WhatsApp</a>
          </div>
        </section>
      </main>

      <footer className="border-t border-nexia-border bg-nexia-surface mt-8">
        <div className="px-4 md:px-8 py-6 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5"><div className="w-7 h-7 flex items-center justify-center rounded-lg bg-nexia-cyan/20"><i className="ri-brain-fill text-nexia-cyan text-sm" /></div><span className="text-white font-bold text-sm tracking-tight">NEXIA<span className="text-nexia-cyan">OS</span></span></div>
          <span className="text-[11px] text-nexia-muted">Docs v1.0 · Build 2026.05.03 · Autonomous QA Engine</span>
        </div>
      </footer>
    </div>
  );
}
