import { useState, useCallback, useRef } from "react";
import { ScrollReveal } from "@/hooks/useScrollReveal";
import { streamCortex } from "@/services/api";

const chips = ["Ver demos", "Falar com vendas", "Integração API", "Parceria"];

export default function Assistant() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string; streaming?: boolean }[]>([
    { role: "assistant", text: "Olá! Sou o NEXIA Assistant. Como posso ajudar você hoje? 👋" },
  ]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setLoading(true);

    const assistantId = Date.now();
    setMessages((prev) => [...prev, { role: "assistant", text: "", streaming: true }]);

    abortRef.current = new AbortController();
    let fullText = "";

    try {
      const gen = streamCortex(
        { message: text, model: "auto", tenantId: "nexia" },
        abortRef.current.signal
      );
      for await (const chunk of gen) {
        if (chunk.token) {
          fullText += chunk.token;
          setMessages((prev) =>
            prev.map((m, i) => i === prev.length - 1 ? { ...m, text: fullText, streaming: !chunk.done } : m)
          );
        }
        if (chunk.done) {
          setMessages((prev) =>
            prev.map((m, i) => i === prev.length - 1 ? { ...m, text: fullText || m.text, streaming: false } : m)
          );
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m, i) => i === prev.length - 1 ? { ...m, text: fullText || "Ocorreu um erro. Tente novamente.", streaming: false } : m)
      );
    }

    // suppress unused var warning
    void assistantId;
    setLoading(false);
    abortRef.current = null;
  }, [loading]);

  return (
    <section className="py-20 px-4 md:px-8 max-w-7xl mx-auto">
      <ScrollReveal direction="up" delay={0}>
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              NEXIA <span className="text-nexia-cyan">Assistant</span>
            </h2>
            <p className="text-nexia-muted">Powered by CORTEX v16 — resposta real via SSE streaming.</p>
          </div>

          <div className="rounded-xl bg-nexia-surface border border-nexia-border overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-nexia-border bg-nexia-surface2">
              <div className={`w-2 h-2 rounded-full ${loading ? "bg-amber-400 animate-pulse" : "bg-nexia-cyan animate-pulse"}`} />
              <span className="text-xs text-nexia-muted">NEXIA Assistant — {loading ? "Processando..." : "Online"}</span>
            </div>

            <div className="p-4 space-y-3 min-h-[200px] max-h-[320px] overflow-y-auto">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${m.role === "user" ? "bg-nexia-cyan/15 text-white border border-nexia-cyan/25" : "bg-nexia-surface2 text-nexia-muted border border-nexia-border"}`}>
                    <span className="whitespace-pre-wrap">{m.text}</span>
                    {m.streaming && <span className="inline-block w-1.5 h-3.5 bg-nexia-cyan animate-pulse ml-1 align-middle" />}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-nexia-border p-3">
              <div className="flex flex-wrap gap-2 mb-3">
                {chips.map((c) => (
                  <button key={c} onClick={() => send(c)} disabled={loading} className="px-3 py-1 text-xs rounded-full bg-nexia-surface2 border border-nexia-border text-nexia-muted hover:text-white hover:border-nexia-cyan/30 transition-all cursor-pointer whitespace-nowrap disabled:opacity-40">
                    {c}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                  placeholder="Digite sua mensagem..."
                  disabled={loading}
                  className="flex-1 px-3 py-2 text-sm bg-nexia-surface2 border border-nexia-border rounded-lg text-white placeholder-nexia-muted outline-none focus:border-nexia-cyan/40 disabled:opacity-50"
                />
                <button
                  onClick={() => send(input)}
                  disabled={loading || !input.trim()}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-nexia-cyan text-[#0a0a0f] hover:bg-nexia-cyan-dim transition-colors cursor-pointer disabled:opacity-40"
                >
                  <i className={loading ? "ri-loader-4-line animate-spin text-sm" : "ri-send-plane-fill text-sm"} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
