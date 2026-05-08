import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ScrollReveal } from "@/hooks/useScrollReveal";

const lines = [
  { delay: 0, type: "info", text: "NEXIA CORTEX v16 — Iniciando orquestrador..." },
  { delay: 600, type: "system", text: "[BOOT] Carregando 50+ providers de IA..." },
  { delay: 1200, type: "system", text: "[REDIS] Conectado — Fila de jobs: 0 pendentes" },
  { delay: 1800, type: "user", text: '> msg: "Crie uma API REST em Node.js com JWT auth"' },
  { delay: 2400, type: "system", text: "[ROUTER] intent → code/dev detectado" },
  { delay: 2800, type: "system", text: "[MODEL] selecionando → DeepSeek Coder V3" },
  { delay: 3200, type: "stream", text: "[STREAM] SSE iniciado — tokens chegando em 14ms..." },
  { delay: 3600, type: "output", text: "const express = require('express');" },
  { delay: 3800, type: "output", text: "const jwt = require('jsonwebtoken');" },
  { delay: 4000, type: "output", text: "// ... código gerado em tempo real ✓" },
  { delay: 4400, type: "info", text: "[DONE] 847 tokens · 1.2s · DeepSeek Coder V3" },
];

export default function CortexTerminal() {
  const navigate = useNavigate();
  const [visibleLines, setVisibleLines] = useState<typeof lines>([]);

  useEffect(() => {
    lines.forEach((line) => {
      setTimeout(() => {
        setVisibleLines((prev) => {
          if (prev.includes(line)) return prev;
          return [...prev, line];
        });
      }, line.delay);
    });
  }, []);

  const colorMap: Record<string, string> = {
    info: "text-nexia-cyan",
    system: "text-nexia-muted",
    user: "text-white",
    stream: "text-amber-400",
    output: "text-emerald-400",
  };

  return (
    <section className="py-20 px-4 md:px-8 max-w-7xl mx-auto">
      <ScrollReveal direction="up" delay={0}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-nexia-cyan/10 border border-nexia-cyan/20 text-xs text-nexia-cyan mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-nexia-cyan animate-pulse" />
              CORTEX v16 — Live
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              Streaming real <span className="text-nexia-cyan">token-a-token</span>
            </h2>
            <p className="text-nexia-muted mb-6 leading-relaxed">
              O CORTEX roteia cada requisição para o melhor modelo disponível. SSE streaming com latência de 14ms, retry automático e fallback inteligente.
            </p>
            <button
              onClick={() => navigate("/cortex-app")}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-nexia-cyan text-[#0a0a0f] text-sm font-semibold hover:bg-nexia-cyan-dim transition-all cursor-pointer"
            >
              <i className="ri-brain-line" /> Abrir CORTEX v16
            </button>
          </div>

          {/* Terminal */}
          <div className="rounded-xl bg-nexia-surface border border-nexia-border overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-nexia-border bg-nexia-surface2">
              <span className="w-3 h-3 rounded-full bg-red-500/80" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="ml-2 text-xs text-nexia-muted font-mono">cortex@nexia-os ~ v16</span>
            </div>
            <div className="p-4 font-mono text-xs space-y-1.5 min-h-[280px]">
              {visibleLines.map((line, i) => (
                <div key={i} className={`${colorMap[line.type] || "text-nexia-muted"} leading-relaxed`}>
                  {line.text}
                </div>
              ))}
              <span className="inline-block w-2 h-4 bg-nexia-cyan animate-pulse ml-0.5" />
            </div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
