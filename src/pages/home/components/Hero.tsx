import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ScrollReveal } from "@/hooks/useScrollReveal";

const stats = [
  { value: "50+", label: "Providers de IA" },
  { value: "99.7%", label: "Uptime SLA" },
  { value: "14ms", label: "Latência média" },
  { value: "2.1M", label: "Tokens/min" },
];

export default function Hero() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 pt-24 pb-16 overflow-hidden">
      {/* Glow background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-nexia-cyan/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-nexia-cyan/3 rounded-full blur-2xl pointer-events-none" />

      <ScrollReveal direction="up" delay={0}>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-nexia-surface border border-nexia-border text-xs text-nexia-muted mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-nexia-cyan animate-pulse" />
          CORTEX v16 · 50+ Providers · SSE Streaming Real
        </div>
      </ScrollReveal>

      <ScrollReveal direction="up" delay={80}>
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white tracking-tight leading-tight mb-6 max-w-5xl">
          {t("hero.title")}{" "}
          <span className="text-nexia-cyan">{t("hero.highlight")}</span>
        </h1>
      </ScrollReveal>

      <ScrollReveal direction="up" delay={160}>
        <p className="text-base md:text-lg text-nexia-muted max-w-2xl mb-10 leading-relaxed">
          {t("hero.subtitle")}
        </p>
      </ScrollReveal>

      <ScrollReveal direction="up" delay={240}>
        <div className="flex flex-col sm:flex-row items-center gap-3 mb-16">
          <button
            onClick={() => navigate("/cortex-app")}
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-nexia-cyan text-[#0a0a0f] text-sm font-semibold hover:bg-nexia-cyan-dim transition-all cursor-pointer whitespace-nowrap"
          >
            <i className="ri-brain-line" /> {t("hero.cta")}
          </button>
          <button
            onClick={() => navigate("/pipeline")}
            className="flex items-center gap-2 px-6 py-3 rounded-lg border border-nexia-border text-nexia-muted text-sm hover:text-white hover:border-nexia-cyan/40 transition-all cursor-pointer whitespace-nowrap"
          >
            <i className="ri-node-tree" /> {t("hero.secondary")}
          </button>
        </div>
      </ScrollReveal>

      <ScrollReveal direction="up" delay={320}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl w-full">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl bg-nexia-surface border border-nexia-border p-4 text-center">
              <div className="text-2xl font-black text-nexia-cyan mb-1">{s.value}</div>
              <div className="text-xs text-nexia-muted">{s.label}</div>
            </div>
          ))}
        </div>
      </ScrollReveal>
    </section>
  );
}
