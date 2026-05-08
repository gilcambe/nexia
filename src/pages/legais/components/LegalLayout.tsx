import { useNavigate } from "react-router-dom";
import { ScrollReveal } from "@/hooks/useScrollReveal";
import type { ReactNode } from "react";

interface LegalLayoutProps { title: string; subtitle: string; lastUpdated: string; children: ReactNode; }

export default function LegalLayout({ title, subtitle, lastUpdated, children }: LegalLayoutProps) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-display antialiased">
      <header className="border-b border-nexia-border bg-[#0a0a0f]">
        <div className="px-4 md:px-8 py-6 max-w-4xl mx-auto">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm text-nexia-muted hover:text-white transition-colors cursor-pointer mb-6">
            <div className="w-7 h-7 flex items-center justify-center rounded-md bg-nexia-cyan/20"><i className="ri-arrow-left-line text-nexia-cyan text-sm" /></div>
            Voltar ao NEXIA OS
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-nexia-cyan/10 border border-nexia-cyan/20"><i className="ri-shield-keyhole-line text-nexia-cyan text-xl" /></div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">{title}</h1>
          </div>
          <p className="text-sm text-nexia-muted">{subtitle}</p>
          <p className="text-xs text-nexia-muted/60 mt-2">Última atualização: {lastUpdated}</p>
        </div>
      </header>
      <main className="px-4 md:px-8 py-8 max-w-4xl mx-auto">
        <ScrollReveal direction="up" delay={0}><div>{children}</div></ScrollReveal>
      </main>
      <footer className="border-t border-nexia-border bg-nexia-surface mt-8">
        <div className="px-4 md:px-8 py-6 max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5"><div className="w-7 h-7 flex items-center justify-center rounded-lg bg-nexia-cyan/20"><i className="ri-brain-fill text-nexia-cyan text-sm" /></div><span className="text-white font-bold text-sm tracking-tight">NEXIA<span className="text-nexia-cyan">OS</span></span></div>
          <span className="text-[11px] text-nexia-muted">© 2026 NEXIA OS · LGPD Compliant · Sistema Seguro</span>
        </div>
      </footer>
    </div>
  );
}
