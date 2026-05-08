import { ScrollReveal } from "@/hooks/useScrollReveal";

const features = [
  { icon: "ri-brain-line", title: "CORTEX v16", desc: "Orquestrador universal com roteamento automático entre 50+ providers de IA. Streaming real SSE token-a-token.", color: "#00d4aa" },
  { icon: "ri-node-tree", title: "Swarm Control", desc: "6 agentes especialistas com memória própria: Dev, Security, Business, Finance, Legal e CORTEX.", color: "#3b82f6" },
  { icon: "ri-shield-keyhole-line", title: "Sentinel QA", desc: "Scan automático de endpoints, detecção de vulnerabilidades, auto-heal e auditoria contínua.", color: "#f59e0b" },
  { icon: "ri-robot-2-line", title: "AutoDev Pipeline", desc: "Clone → Testa → Corrige → Empacota → Entrega. Docker Sandbox + Playwright + k6 + OWASP ZAP.", color: "#ec4899" },
  { icon: "ri-database-2-line", title: "RAG & Memória", desc: "Memória persistente por tenant, RAG sobre documentos e base de conhecimento customizável.", color: "#8b5cf6" },
  { icon: "ri-global-line", title: "Multi-tenant", desc: "CES, Bezsan, Viajante Pro e Splash. Cada tenant com seus próprios dados, features e UI.", color: "#10b981" },
];

export default function Features() {
  return (
    <section className="py-20 px-4 md:px-8 max-w-7xl mx-auto">
      <ScrollReveal direction="up" delay={0}>
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            Tudo que você precisa para <span className="text-nexia-cyan">escalar com IA</span>
          </h2>
          <p className="text-nexia-muted max-w-xl mx-auto">
            Uma plataforma SaaS enterprise completa, do chat ao deploy autônomo.
          </p>
        </div>
      </ScrollReveal>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((f, i) => (
          <ScrollReveal key={f.title} direction="up" delay={80 + i * 60}>
            <div className="rounded-xl bg-nexia-surface border border-nexia-border p-5 hover:border-nexia-cyan/20 transition-all group">
              <div className="w-10 h-10 flex items-center justify-center rounded-lg mb-4" style={{ backgroundColor: `${f.color}15`, border: `1px solid ${f.color}25` }}>
                <i className={`${f.icon} text-lg`} style={{ color: f.color }} />
              </div>
              <h3 className="text-sm font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-xs text-nexia-muted leading-relaxed">{f.desc}</p>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
