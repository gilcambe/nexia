import { ScrollReveal } from "@/hooks/useScrollReveal";

const providers = [
  { name: "Claude", color: "#d4a27a", icon: "ri-robot-line" },
  { name: "GPT-4o", color: "#10b981", icon: "ri-openai-line" },
  { name: "Gemini", color: "#4285f4", icon: "ri-google-line" },
  { name: "Grok", color: "#e5e7eb", icon: "ri-flashlight-line" },
  { name: "DeepSeek", color: "#7c3aed", icon: "ri-search-eye-line" },
  { name: "Llama", color: "#f59e0b", icon: "ri-meta-line" },
];

export default function Orchestrator() {
  return (
    <section className="py-20 px-4 md:px-8 max-w-7xl mx-auto">
      <ScrollReveal direction="up" delay={0}>
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            Um <span className="text-nexia-cyan">orquestrador</span>, todos os modelos
          </h2>
          <p className="text-nexia-muted max-w-xl mx-auto">
            CORTEX roteia automaticamente para o melhor modelo para cada tarefa, com fallback inteligente e streaming real token-a-token.
          </p>
        </div>
      </ScrollReveal>

      <ScrollReveal direction="up" delay={80}>
        <div className="relative flex items-center justify-center">
          {/* Center */}
          <div className="relative z-10 w-24 h-24 flex items-center justify-center rounded-2xl bg-nexia-cyan/10 border-2 border-nexia-cyan/40">
            <i className="ri-brain-fill text-nexia-cyan text-4xl" />
          </div>
          {/* Providers ring */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-80 h-80">
              {providers.map((p, i) => {
                const angle = (i / providers.length) * 2 * Math.PI - Math.PI / 2;
                const x = Math.cos(angle) * 140 + 140;
                const y = Math.sin(angle) * 140 + 140;
                return (
                  <div key={p.name} className="absolute" style={{ left: x - 24, top: y - 24 }}>
                    <div className="w-12 h-12 flex flex-col items-center justify-center rounded-xl bg-nexia-surface border border-nexia-border hover:border-nexia-cyan/30 transition-all">
                      <i className={`${p.icon} text-sm`} style={{ color: p.color }} />
                      <span className="text-[8px] text-nexia-muted mt-0.5">{p.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="h-72" />
        </div>
      </ScrollReveal>
    </section>
  );
}
