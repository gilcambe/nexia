import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ScrollReveal } from "@/hooks/useScrollReveal";
import { streamCortex } from "@/services/api";

interface Agent {
  id: string; name: string; emoji: string; role: string; specialty: string;
  status: "idle" | "working"; tasks: number;
}

const AGENTS: Agent[] = [
  { id: "cortex", name: "CORTEX", emoji: "🧠", role: "Orquestrador", specialty: "Análise, roteamento e coordenação de modelos de IA", status: "working", tasks: 12 },
  { id: "dev", name: "Dev Agent", emoji: "💻", role: "Principal Engineer", specialty: "Firebase, React, TypeScript, Python, arquitetura SaaS", status: "idle", tasks: 3 },
  { id: "security", name: "Security Agent", emoji: "🛡", role: "CISO Virtual", specialty: "OWASP, LGPD, Firebase Rules, pentest, criptografia", status: "idle", tasks: 0 },
  { id: "business", name: "Business Agent", emoji: "📊", role: "Consultor Estratégico", specialty: "SaaS, MRR, churn, pricing, vendas e crescimento", status: "working", tasks: 5 },
  { id: "finance", name: "Finance Agent", emoji: "💰", role: "CFO Virtual", specialty: "DRE, fluxo de caixa, valuation e análise de crédito", status: "idle", tasks: 1 },
  { id: "legal", name: "Legal Agent", emoji: "⚖️", role: "Compliance", specialty: "Contratos SaaS, LGPD, editais, cláusulas abusivas", status: "idle", tasks: 0 },
];

export default function SwarmControl() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);
  const [taskInput, setTaskInput] = useState("");
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const abortRef = { current: null as AbortController | null };

  const agent = AGENTS.find((a) => a.id === selected);

  const runAgent = useCallback(async () => {
    if (!selected || !taskInput.trim() || loading) return;
    setLoading(true);
    setStreaming(true);
    setResult("");

    const prompt = `[${selected.toUpperCase()} AGENT] ${taskInput}`;
    abortRef.current = new AbortController();
    let fullText = "";

    try {
      const gen = streamCortex(
        { message: prompt, model: "auto", tenantId: "nexia" },
        abortRef.current.signal
      );

      for await (const chunk of gen) {
        if (chunk.token) {
          fullText += chunk.token;
          setResult(fullText);
        }
        if (chunk.done) break;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      if (!msg.includes("abort")) {
        setResult(fullText || "❌ Erro ao conectar ao backend: " + msg + "\n\nVerifique se o Render está online.");
      }
    }

    // Always finalize
    if (!fullText) {
      setResult("⏳ Sem resposta do servidor. O Render free tier pode estar dormindo — aguarde 60s e tente novamente.");
    }

    setLoading(false);
    setStreaming(false);
    abortRef.current = null;
  }, [selected, taskInput, loading]);

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
    setStreaming(false);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-display antialiased">
      <header className="border-b border-nexia-border bg-[#0a0a0f]">
        <div className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm text-nexia-muted hover:text-white transition-colors cursor-pointer">
              <i className="ri-arrow-left-line" /> Voltar ao site
            </button>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-nexia-cyan animate-pulse" />
              <span className="text-xs text-nexia-cyan font-medium">
                {AGENTS.filter(a => a.status === "working").length} agentes ativos
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-nexia-cyan/10 border border-nexia-cyan/20">
              <i className="ri-node-tree text-nexia-cyan text-xl" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Swarm Control</h1>
              <p className="text-sm text-nexia-muted">6 agentes especialistas · Streaming real via CORTEX · Memória por contexto</p>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
        <ScrollReveal direction="up" delay={0}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Agent list */}
            <div className="lg:col-span-1 space-y-2">
              {AGENTS.map((a) => (
                <button key={a.id}
                  onClick={() => { setSelected(a.id); setResult(""); }}
                  className={`w-full text-left rounded-xl border p-4 transition-all duration-200 cursor-pointer ${
                    selected === a.id
                      ? "bg-nexia-cyan/10 border-nexia-cyan/40"
                      : "bg-nexia-surface border-nexia-border hover:border-nexia-border/80"
                  }`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl flex-shrink-0">{a.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm">{a.name}</span>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.status === "working" ? "bg-nexia-cyan animate-pulse" : "bg-nexia-muted/40"}`} />
                      </div>
                      <p className="text-xs text-nexia-muted truncate">{a.role}</p>
                    </div>
                    <span className="text-xs text-nexia-muted bg-nexia-surface2 px-2 py-0.5 rounded-full border border-nexia-border flex-shrink-0">{a.tasks}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Detail panel */}
            <div className="lg:col-span-2">
              {agent ? (
                <div className="rounded-xl bg-nexia-surface border border-nexia-border p-5 md:p-6 h-full">
                  {/* Agent info */}
                  <div className="flex items-start gap-3 mb-5">
                    <span className="text-4xl">{agent.emoji}</span>
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-white">{agent.name}</h2>
                      <p className="text-sm text-nexia-cyan">{agent.role}</p>
                      <p className="text-xs text-nexia-muted mt-1">{agent.specialty}</p>
                    </div>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full border flex-shrink-0 ${
                      agent.status === "working"
                        ? "bg-nexia-cyan/10 text-nexia-cyan border-nexia-cyan/30"
                        : "bg-nexia-surface2 text-nexia-muted border-nexia-border"
                    }`}>
                      {agent.status === "working" ? "● Ativo" : "○ Idle"}
                    </span>
                  </div>

                  {/* Task input */}
                  <div className="mb-4">
                    <label className="text-xs text-nexia-muted mb-2 block font-medium">Atribuir tarefa ao {agent.name}</label>
                    <textarea
                      value={taskInput}
                      onChange={(e) => setTaskInput(e.target.value)}
                      placeholder={`Ex: Analise o código deste endpoint e identifique vulnerabilidades OWASP...`}
                      rows={3}
                      disabled={loading}
                      className="w-full px-3 py-2.5 text-sm bg-nexia-surface2 border border-nexia-border rounded-lg text-white placeholder-nexia-muted outline-none focus:border-nexia-cyan/40 resize-none disabled:opacity-60"
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-3 mb-5">
                    <button
                      onClick={runAgent}
                      disabled={loading || !taskInput.trim()}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-nexia-cyan text-[#0a0a0f] rounded-lg hover:bg-nexia-cyan-dim transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap"
                    >
                      {loading
                        ? <><i className="ri-loader-4-line animate-spin" /> Processando...</>
                        : <><i className="ri-play-fill" /> Executar via CORTEX</>
                      }
                    </button>
                    {loading && (
                      <button
                        onClick={stopStream}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-red-500/15 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/25 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <i className="ri-stop-fill" /> Parar
                      </button>
                    )}
                  </div>

                  {/* Result */}
                  {(result || streaming) && (
                    <div className="rounded-lg bg-nexia-surface2 border border-nexia-border overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-nexia-border">
                        <div className="flex items-center gap-2">
                          <i className="ri-terminal-line text-nexia-cyan text-xs" />
                          <span className="text-xs font-medium text-nexia-cyan">Resposta do {agent.name}</span>
                          {streaming && <span className="w-1.5 h-1.5 rounded-full bg-nexia-cyan animate-pulse" />}
                        </div>
                        {result && (
                          <button
                            onClick={() => navigator.clipboard.writeText(result)}
                            className="text-xs text-nexia-muted hover:text-white flex items-center gap-1 cursor-pointer"
                          >
                            <i className="ri-file-copy-line" /> Copiar
                          </button>
                        )}
                      </div>
                      <div className="p-4 max-h-[400px] overflow-y-auto">
                        <pre className="text-xs text-nexia-muted whitespace-pre-wrap break-words leading-relaxed">
                          {result}
                          {streaming && <span className="inline-block w-1.5 h-3.5 bg-nexia-cyan animate-pulse ml-0.5 align-middle" />}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl bg-nexia-surface border border-nexia-border p-10 flex flex-col items-center justify-center text-center min-h-[300px]">
                  <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-nexia-surface2 border border-nexia-border mb-4">
                    <i className="ri-node-tree text-nexia-muted text-2xl" />
                  </div>
                  <p className="text-sm font-medium text-white mb-2">Selecione um agente</p>
                  <p className="text-xs text-nexia-muted max-w-xs">Escolha um agente especialista à esquerda para atribuir tarefas com streaming real via CORTEX.</p>
                </div>
              )}
            </div>
          </div>
        </ScrollReveal>
      </main>
    </div>
  );
}
