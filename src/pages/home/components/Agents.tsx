import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ScrollReveal } from "@/hooks/useScrollReveal";
import { agents } from "@/data/agentData";

export default function Agents() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <section className="py-20 px-4 md:px-8 max-w-7xl mx-auto">
      <ScrollReveal direction="up" delay={0}>
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            Swarm de <span className="text-nexia-cyan">Agentes Especialistas</span>
          </h2>
          <p className="text-nexia-muted max-w-xl mx-auto">
            6 agentes com memória própria, especialidades distintas e capacidade de colaboração em paralelo.
          </p>
        </div>
      </ScrollReveal>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {agents.map((agent, i) => (
          <ScrollReveal key={agent.id} direction="up" delay={80 + i * 60}>
            <div className="rounded-xl bg-nexia-surface border border-nexia-border p-5 hover:border-nexia-cyan/20 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{agent.emoji}</span>
                <div>
                  <h3 className="font-semibold text-white text-sm">{agent.name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-nexia-cyan animate-pulse" />
                    <span className="text-[10px] text-nexia-muted uppercase tracking-wider">Online</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-nexia-muted leading-relaxed">{t(agent.descKey)}</p>
            </div>
          </ScrollReveal>
        ))}
      </div>

      <ScrollReveal direction="up" delay={200}>
        <div className="text-center">
          <button
            onClick={() => navigate("/swarm-control")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-nexia-surface border border-nexia-border text-sm text-nexia-muted hover:text-white hover:border-nexia-cyan/40 transition-all cursor-pointer mx-auto"
          >
            <i className="ri-node-tree" /> Controlar Swarm
          </button>
        </div>
      </ScrollReveal>
    </section>
  );
}
