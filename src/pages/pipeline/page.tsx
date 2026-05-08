import { useState } from "react";
import { ScrollReveal } from "@/hooks/useScrollReveal";
import { useNavigate } from "react-router-dom";

const layers = [
  { id: "front", title: "FRONT (React + Vite)", icon: "ri-reactjs-line", color: "#00d4aa", desc: "SPA com React 18, TypeScript, TailwindCSS, i18n, React Router. Deploy no Render.", status: "online", metrics: { uptime: "99.9%", latency: "45ms", requests: "2.4k/min" } },
  { id: "gateway", title: "API GATEWAY", icon: "ri-server-line", color: "#3b82f6", desc: "Rate limiting, auth JWT, routing de jobs, webhook receivers. Node.js + Express.", status: "online", metrics: { uptime: "99.7%", latency: "12ms", requests: "850/min" } },
  { id: "orchestrator", title: "ORCHESTRATOR", icon: "ri-brain-line", color: "#f59e0b", desc: "Coordena filas, workers, containers e IA. Job lifecycle management. BullMQ.", status: "online", metrics: { jobs: "1.2k/day", avgQueue: "3s", workers: 8 } },
  { id: "queue", title: "JOB QUEUE (Redis)", icon: "ri-database-2-line", color: "#ef4444", desc: "BullMQ sobre Redis. Filas: analyze, fix, test, deploy. Retry com backoff.", status: "online", metrics: { pending: 12, processing: 4, completed: "8.4k" } },
  { id: "workers", title: "WORKER POOL", icon: "ri-cpu-line", color: "#8b5cf6", desc: "8 workers Node.js paralelos. Processam jobs de clone, build, test e fix.", status: "online", metrics: { active: 4, idle: 4, capacity: "100%" } },
  { id: "ai", title: "AI ENGINE (Ollama)", icon: "ri-robot-2-line", color: "#ec4899", desc: "Mistral 7B local via Ollama. Análise de código, correções, refatoração.", status: "online", metrics: { tokens: "2.1M/min", accuracy: "94.2%", latency: "890ms" } },
  { id: "docker", title: "DOCKER SANDBOX", icon: "ri-ship-line", color: "#10b981", desc: "Containers isolados por job. Playwright, k6, ZAP, ESLint rodando em sandbox.", status: "online", metrics: { containers: 4, images: 12, isolation: "100%" } },
  { id: "storage", title: "STORAGE", icon: "ri-hard-drive-3-line", color: "#6366f1", desc: "Relatórios JSON, logs, ZIPs de deploy. S3-compatível. Retenção 90 dias.", status: "online", metrics: { size: "48GB", files: "12.4k", retention: "90d" } },
];

const activeJobs = [
  { id: "job-7281", repo: "github.com/nexia/core", stage: "Docker Test", progress: 73, eta: "2m 14s" },
  { id: "job-7282", repo: "github.com/nexia/web", stage: "AI Analysis", progress: 45, eta: "4m 30s" },
  { id: "job-7283", repo: "github.com/client/saas", stage: "Security Scan", progress: 91, eta: "30s" },
  { id: "job-7280", repo: "github.com/nexia/api", stage: "Zipping Output", progress: 98, eta: "5s" },
];

const flowSteps = [
  { label: "Usuário cola link", icon: "ri-link", color: "#9ca3af" },
  { label: "Sistema cria job", icon: "ri-file-add-line", color: "#3b82f6" },
  { label: "Worker sobe container", icon: "ri-ship-line", color: "#10b981" },
  { label: "Roda testes", icon: "ri-test-tube-line", color: "#f59e0b" },
  { label: "IA corrige", icon: "ri-robot-2-line", color: "#ec4899" },
  { label: "Gera relatório", icon: "ri-file-chart-line", color: "#00d4aa" },
  { label: "Empacota ZIP", icon: "ri-folder-zip-line", color: "#8b5cf6" },
  { label: "Entrega ao usuário", icon: "ri-download-cloud-line", color: "#00d4aa" },
];

const techStack = ["React 18", "TypeScript", "TailwindCSS", "Vite", "Node.js", "BullMQ", "Redis", "Docker", "Playwright", "k6", "OWASP ZAP", "ESLint", "Ollama", "Mistral 7B", "JWT", "S3"];

export default function PipelinePage() {
  const navigate = useNavigate();
  const [hoveredLayer, setHoveredLayer] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-display antialiased">
      <header className="border-b border-nexia-border bg-[#0a0a0f]">
        <div className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm text-nexia-muted hover:text-white transition-colors cursor-pointer">
              <div className="w-7 h-7 flex items-center justify-center rounded-md bg-nexia-cyan/20"><i className="ri-arrow-left-line text-nexia-cyan text-sm" /></div>
              Voltar ao site
            </button>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate("/sentinel")} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-nexia-cyan bg-nexia-cyan/10 border border-nexia-cyan/20 rounded-lg hover:bg-nexia-cyan/15 transition-colors cursor-pointer whitespace-nowrap"><i className="ri-shield-keyhole-line" /> Sentinel QA</button>
              <button onClick={() => navigate("/codigo")} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-nexia-cyan bg-nexia-cyan/10 border border-nexia-cyan/20 rounded-lg hover:bg-nexia-cyan/15 transition-colors cursor-pointer whitespace-nowrap"><i className="ri-code-box-line" /> Ver Código</button>
            </div>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-nexia-cyan/10 border border-nexia-cyan/20"><i className="ri-node-tree text-nexia-cyan text-xl" /></div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">NEXIA OS Pipeline</h1>
          </div>
          <p className="text-sm md:text-base text-nexia-muted max-w-lg">Ecossistema autônomo de QA + auto-refatoração. Clone → Testa → Corrige → Empacota → Entrega.</p>
        </div>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
        {/* Architecture Cards */}
        <ScrollReveal direction="up" delay={80}>
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5"><i className="ri-node-tree text-nexia-cyan" /><h2 className="text-lg font-semibold text-white">Arquitetura Distribuída</h2></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {layers.map((layer) => (
                <div key={layer.id}
                  className={`relative rounded-xl bg-nexia-surface border p-5 hover:border-nexia-cyan/30 transition-all duration-300 cursor-default ${hoveredLayer === layer.id ? "border-nexia-cyan/30" : "border-nexia-border"}`}
                  onMouseEnter={() => setHoveredLayer(layer.id)}
                  onMouseLeave={() => setHoveredLayer(null)}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 flex items-center justify-center rounded-lg" style={{ backgroundColor: `${layer.color}15`, border: `1px solid ${layer.color}25` }}>
                      <i className={`${layer.icon} text-lg`} style={{ color: layer.color }} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{layer.title}</h3>
                      <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /><span className="text-[10px] text-nexia-muted uppercase tracking-wider">{layer.status}</span></div>
                    </div>
                  </div>
                  <p className="text-xs text-nexia-muted leading-relaxed mb-3">{layer.desc}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(layer.metrics).map(([k, v]) => (
                      <div key={k} className="rounded-lg bg-nexia-surface2 border border-nexia-border/50 p-2">
                        <div className="text-xs font-semibold text-white">{String(v)}</div>
                        <div className="text-[9px] text-nexia-muted capitalize">{k}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </ScrollReveal>

        {/* Active Jobs */}
        <ScrollReveal direction="up" delay={120}>
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <i className="ri-loader-4-line text-nexia-cyan animate-spin" />
              <h2 className="text-lg font-semibold text-white">Jobs em Execução</h2>
              <span className="ml-2 text-xs text-nexia-muted bg-nexia-surface2 px-2 py-0.5 rounded-full border border-nexia-border">{activeJobs.length} ativos</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeJobs.map((job) => (
                <div key={job.id} className="rounded-xl bg-nexia-surface border border-nexia-border p-4 hover:border-nexia-cyan/20 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2"><span className="text-xs font-mono text-nexia-cyan">{job.id}</span><span className="text-xs text-nexia-muted">{job.repo}</span></div>
                    <span className="text-[11px] text-nexia-muted">ETA {job.eta}</span>
                  </div>
                  <div className="flex items-center justify-between mb-1.5"><span className="text-xs text-white font-medium">{job.stage}</span><span className="text-xs text-nexia-cyan font-semibold">{job.progress}%</span></div>
                  <div className="w-full h-2 rounded-full bg-nexia-surface2 overflow-hidden"><div className="h-full rounded-full bg-nexia-cyan transition-all duration-700" style={{ width: job.progress + "%" }} /></div>
                </div>
              ))}
            </div>
          </section>
        </ScrollReveal>

        {/* Flow */}
        <ScrollReveal direction="up" delay={160}>
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5"><i className="ri-flow-chart text-nexia-cyan" /><h2 className="text-lg font-semibold text-white">Fluxo Autônomo</h2></div>
            <div className="rounded-xl bg-nexia-surface border border-nexia-border p-6 md:p-8">
              <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
                {flowSteps.map((step, i) => (
                  <div key={step.label} className="flex items-center gap-2 md:gap-3">
                    <div className="flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-lg bg-nexia-surface2 border border-nexia-border/50 min-w-[90px]">
                      <i className={`${step.icon}`} style={{ color: step.color }} />
                      <span className="text-[10px] text-nexia-muted text-center leading-tight">{step.label}</span>
                    </div>
                    {i < flowSteps.length - 1 && <i className="ri-arrow-right-line text-nexia-muted/40" />}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </ScrollReveal>

        {/* Tech Stack */}
        <ScrollReveal direction="up" delay={200}>
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5"><i className="ri-stack-line text-nexia-cyan" /><h2 className="text-lg font-semibold text-white">Stack Técnico</h2></div>
            <div className="flex flex-wrap gap-2">
              {techStack.map((tech) => (
                <span key={tech} className="px-3 py-1.5 text-xs font-medium text-nexia-muted bg-nexia-surface2 border border-nexia-border rounded-md hover:border-nexia-cyan/30 hover:text-nexia-cyan transition-all duration-200">{tech}</span>
              ))}
            </div>
          </section>
        </ScrollReveal>

        {/* CTA */}
        <ScrollReveal direction="up" delay={240}>
          <section className="text-center py-8">
            <h3 className="text-xl font-bold text-white mb-3">Pronto para escalar seu QA?</h3>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a href="https://wa.me/5511944037259?text=Quero%20deployar%20o%20pipeline%20de%20QA%20da%20NEXIA%20OS!" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-all whitespace-nowrap"><i className="ri-whatsapp-fill" /> Quero Deployar</a>
              <button onClick={() => navigate("/codigo")} className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-nexia-border text-nexia-muted text-sm hover:text-white hover:border-nexia-cyan/40 transition-all whitespace-nowrap cursor-pointer"><i className="ri-code-box-line" /> Ver Código-Fonte</button>
            </div>
          </section>
        </ScrollReveal>
      </main>

      <footer className="border-t border-nexia-border bg-nexia-surface mt-8">
        <div className="px-4 md:px-8 py-6 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5"><div className="w-7 h-7 flex items-center justify-center rounded-lg bg-nexia-cyan/20"><i className="ri-brain-fill text-nexia-cyan text-sm" /></div><span className="text-white font-bold text-sm tracking-tight">NEXIA<span className="text-nexia-cyan">OS</span></span></div>
          <span className="text-[11px] text-nexia-muted">Pipeline v1.0 · Build 2026.05.03 · Autonomous QA Engine</span>
        </div>
      </footer>
    </div>
  );
}
