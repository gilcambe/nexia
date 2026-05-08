import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { streamCortex } from "@/services/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  model?: string;
  streaming?: boolean;
}

const MODEL_OPTIONS = [
  { value: "auto", label: "Auto-route" },
  { value: "claude", label: "Claude Sonnet 4.6" },
  { value: "claude_opus", label: "Claude Opus 4.5" },
  { value: "gpt4o", label: "GPT-4o" },
  { value: "gemini_25_pro", label: "Gemini 2.5 Pro" },
  { value: "gemini_25_flash", label: "Gemini 2.5 Flash" },
  { value: "groq_llama4_scout", label: "Llama 4 Scout (Groq)" },
  { value: "groq_llama4_maverick", label: "Llama 4 Maverick (Groq)" },
  { value: "groq_deepseek_r1", label: "DeepSeek R1 (Groq)" },
  { value: "deepseek_v3", label: "DeepSeek V3" },
  { value: "grok3", label: "Grok-3 Fast" },
  { value: "perplexity", label: "Perplexity" },
  { value: "cerebras_llama4", label: "Llama 4 Scout (Cerebras)" },
  { value: "or_deepseek_r1", label: "DeepSeek R1 (OpenRouter)" },
  { value: "or_qwen3_coder", label: "Qwen3 Coder (OpenRouter)" },
];

const CHIPS = [
  "Orquestre 3 modelos de IA",
  "Crie uma API REST em Node.js",
  "Análise de segurança OWASP",
  "Gere uma landing page React",
  "Previsão de churn SaaS",
];

export default function CortexApp() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Olá! Sou o CORTEX v16 — orquestrador universal de IA com 50+ providers. Posso rotear sua requisição entre Claude, GPT-4o, Gemini, DeepSeek, Grok, Groq, Cerebras e mais — com streaming real token-a-token. O que você precisa?",
      model: "CORTEX v16",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("auto");
  const [serverStarting, setServerStarting] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const finalizeMessage = useCallback((id: string, text: string, model: string) => {
    setMessages((prev) =>
      prev.map((m) => m.id === id ? { ...m, text: text || m.text, streaming: false, model } : m)
    );
  }, []);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setErrorBanner(null);
    setServerStarting(false);

    const userMsg: Message = { id: "u-" + Date.now(), role: "user", text };
    const assistantId = "a-" + Date.now();
    const initialModel = selectedModel === "auto" ? "CORTEX (roteando...)" : selectedModel;

    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: "assistant", text: "", model: initialModel, streaming: true },
    ]);
    setInput("");
    setLoading(true);

    abortRef.current = new AbortController();
    let fullText = "";
    let modelUsed = initialModel;
    let receivedDone = false;

    try {
      const gen = streamCortex(
        { message: text, model: selectedModel, tenantId: "nexia" },
        abortRef.current.signal
      );

      for await (const chunk of gen) {
        // Accumulate token
        if (chunk.token) {
          fullText += chunk.token;
        }

        // Track model from server
        if (chunk.model) {
          modelUsed = chunk.model;
        }

        // Update UI with current text
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, text: fullText, model: modelUsed, streaming: !chunk.done }
              : m
          )
        );

        // If done flag received, finalize immediately
        if (chunk.done) {
          receivedDone = true;
          break;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro de rede";
      if (msg.includes("abort") || msg.includes("cancel")) {
        // User aborted — finalize with whatever we have
      } else if (!fullText) {
        // No text received at all — cold start or network error
        setServerStarting(true);
        setErrorBanner("Servidor inicializando (cold start do Render). Aguarde ~60s e tente novamente.");
        fullText = "⏳ Servidor acordando... O Render free tier pode levar até 60s no primeiro acesso. Aguarde e envie sua mensagem novamente.";
        modelUsed = "Offline";
      } else {
        setErrorBanner("Erro de streaming: " + msg);
      }
    }

    // Always finalize — clears streaming spinner even if done flag never arrived
    if (!receivedDone) {
      finalizeMessage(assistantId, fullText, modelUsed);
    }

    setLoading(false);
    abortRef.current = null;
  }, [loading, selectedModel, finalizeMessage]);

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    // Finalize the last streaming message
    setMessages((prev) =>
      prev.map((m) => m.streaming ? { ...m, streaming: false } : m)
    );
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-nexia-border bg-[#0a0a0f] flex-shrink-0">
        <div className="px-4 md:px-8 py-4 max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="flex items-center gap-1.5 text-sm text-nexia-muted hover:text-white transition-colors cursor-pointer">
              <i className="ri-arrow-left-line" /> Voltar
            </button>
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-nexia-cyan/15 border border-nexia-cyan/20">
              <i className="ri-brain-fill text-nexia-cyan" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">CORTEX v16</h1>
              <p className="text-[10px] text-nexia-muted">50+ Providers · SSE Streaming Real · Stop Button · Auto-route</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${loading ? "bg-amber-400 animate-pulse" : "bg-nexia-cyan animate-pulse"}`} />
            <span className="text-xs text-nexia-cyan">{loading ? "Processando..." : "Online"}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] md:max-w-[72%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-nexia-cyan/15 text-white border border-nexia-cyan/25"
                  : "bg-nexia-surface text-nexia-muted border border-nexia-border"
              }`}>
                {msg.role === "assistant" && msg.model && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <i className="ri-brain-line text-nexia-cyan text-xs" />
                    <span className="text-[10px] font-semibold text-nexia-cyan uppercase tracking-wider">{msg.model}</span>
                    {msg.streaming && <span className="w-1.5 h-1.5 rounded-full bg-nexia-cyan animate-pulse ml-1" />}
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                {msg.streaming && msg.text && (
                  <div className="mt-2 flex items-center gap-1.5 border-t border-nexia-border/50 pt-2">
                    <i className="ri-loader-4-line animate-spin text-nexia-cyan text-xs" />
                    <span className="text-[10px] text-nexia-muted">Recebendo tokens...</span>
                  </div>
                )}
                {msg.streaming && !msg.text && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-nexia-cyan animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-nexia-cyan animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-nexia-cyan animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="px-4 md:px-8 py-4 border-t border-nexia-border flex-shrink-0">
          {serverStarting && (
            <div className="mb-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <i className="ri-time-line text-amber-400 text-xs flex-shrink-0" />
                <span className="text-xs text-amber-300">Servidor Render acordando... Primeiro acesso pode levar até 60s.</span>
              </div>
              <button onClick={() => setServerStarting(false)} className="text-amber-400/60 hover:text-amber-400 cursor-pointer flex-shrink-0">
                <i className="ri-close-line text-xs" />
              </button>
            </div>
          )}
          {errorBanner && !serverStarting && (
            <div className="mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-between gap-2">
              <span className="text-xs text-red-300">{errorBanner}</span>
              <button onClick={() => setErrorBanner(null)} className="text-red-400/60 hover:text-red-400 cursor-pointer flex-shrink-0">
                <i className="ri-close-line text-xs" />
              </button>
            </div>
          )}

          {/* Quick chips */}
          <div className="flex flex-wrap gap-2 mb-3">
            {CHIPS.map((c) => (
              <button key={c} onClick={() => send(c)} disabled={loading}
                className="px-3 py-1 text-xs rounded-full bg-nexia-surface2 border border-nexia-border text-nexia-muted hover:text-white hover:border-nexia-cyan/30 transition-all cursor-pointer whitespace-nowrap disabled:opacity-40">
                {c}
              </button>
            ))}
          </div>

          {/* Input row */}
          <div className="flex items-center gap-2">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={loading}
              className="px-3 py-2.5 text-xs bg-nexia-surface border border-nexia-border rounded-lg text-nexia-muted outline-none focus:border-nexia-cyan/40 disabled:opacity-60 max-w-[160px]"
            >
              {MODEL_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder="Digite sua mensagem... (Enter para enviar)"
              disabled={loading}
              className="flex-1 px-4 py-2.5 text-sm bg-nexia-surface border border-nexia-border rounded-lg text-white placeholder-nexia-muted outline-none focus:border-nexia-cyan/40 disabled:opacity-60"
            />
            {loading ? (
              <button
                onClick={stopStream}
                title="Parar geração"
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-colors cursor-pointer flex-shrink-0"
              >
                <i className="ri-stop-fill text-lg" />
              </button>
            ) : (
              <button
                onClick={() => send(input)}
                disabled={!input.trim()}
                title="Enviar mensagem"
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-nexia-cyan text-[#0a0a0f] hover:bg-nexia-cyan-dim transition-colors disabled:opacity-40 cursor-pointer flex-shrink-0"
              >
                <i className="ri-send-plane-fill" />
              </button>
            )}
          </div>
          <p className="text-[10px] text-nexia-muted mt-2">
            Streaming SSE real · Stop interrompe imediatamente · {MODEL_OPTIONS.length} modelos disponíveis
          </p>
        </div>
      </main>
    </div>
  );
}
