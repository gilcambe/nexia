import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ThemeContext, useTheme } from "@/hooks/useTheme";
import Sidebar from "@/pages/cortex-app/components/Sidebar";
import ChatArea from "@/pages/cortex-app/components/ChatArea";
import PreviewPanel from "@/pages/cortex-app/components/PreviewPanel";
import { cn } from "@/lib/utils";
import { streamCortex } from "@/services/api";
import { listarProjetos, obterProjeto, salvarProjeto, apagarProjeto, montarPrompt, type ProjetoCortex } from "@/lib/projetosCortex";
import { lerConfigGoogle, salvarConfigGoogle, testarGoogle, listarAgenda, criarEvento, buscarDrive, lerDrive, textoAgenda, parecePerguntaDeAgenda, lerComandoAgendar, urlImagem, type ConfigGoogle } from "@/lib/googleCortex";
import { verificarConexoes, type Conexao } from "@/lib/conexoesCortex";
import { novaConversaId, salvarConversa, listarConversas, obterConversa, apagarConversa, type Conversa } from "@/lib/conversasCortex";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  model?: string;
  streaming?: boolean;
  imagem?: string;
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

const BOAS_VINDAS: Message = {
  id: "welcome",
  role: "assistant",
  text: "Olá! Sou o CORTEX v16 — orquestrador universal de IA com 50+ providers. Posso rotear sua requisição entre Claude, GPT-4o, Gemini, DeepSeek, Grok, Groq, Cerebras e mais — com streaming real token-a-token. O que você precisa?",
  model: "CORTEX v16",
};

export default function CortexPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([BOAS_VINDAS]);
  const [input, setInput] = useState("");
  const [conversaId, setConversaId] = useState(() => novaConversaId());
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("auto");
  const [serverStarting, setServerStarting] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [conversas, setConversas] = useState<Conversa[]>(() => listarConversas());
  const [projetos, setProjetos] = useState<ProjetoCortex[]>(() => listarProjetos());
  const [projetoId, setProjetoId] = useState<string>("");
  const [conexoesAberto, setConexoesAberto] = useState(false);
  const [google, setGoogle] = useState<ConfigGoogle | null>(() => lerConfigGoogle());
  const [googleForm, setGoogleForm] = useState<ConfigGoogle>(() => lerConfigGoogle() || { url: "", segredo: "" });
  const [googleMsg, setGoogleMsg] = useState("");
  const [conexoes, setConexoes] = useState<Conexao[]>([]);
  const [editando, setEditando] = useState<{ id?: string; nome: string; instrucoes: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (loading || !messages.some((m) => m.role === "user")) return;
    const primeira = messages.find((m) => m.role === "user")?.text || "Conversa";
    salvarConversa({
      id: conversaId,
      titulo: primeira.slice(0, 60),
      atualizadaEm: Date.now(),
      projetoId: projetoId || undefined,
      mensagens: messages.filter((m) => m.id !== "welcome").map(({ id, role, text, model, imagem }) => ({ id, role, text, model, imagem })),
    });
    setConversas(listarConversas());
  }, [messages, loading, conversaId, projetoId]);

  useEffect(() => {
    if (!conexoesAberto) return;
    setConexoes([]);
    verificarConexoes().then(setConexoes);
  }, [conexoesAberto]);

  const novaConversa = useCallback(() => {
    if (loading) return;
    setConversaId(novaConversaId());
    setMessages([BOAS_VINDAS]);
    setHistoricoAberto(false);
  }, [loading]);

  const abrirConversa = useCallback((id: string) => {
    if (loading) return;
    const c = obterConversa(id);
    if (!c) return;
    setConversaId(c.id);
    setProjetoId(c.projetoId && obterProjeto(c.projetoId) ? c.projetoId : "");
    setMessages([BOAS_VINDAS, ...c.mensagens]);
    setHistoricoAberto(false);
  }, [loading]);

  const excluirConversa = useCallback((id: string) => {
    apagarConversa(id);
    setConversas(listarConversas());
    if (id === conversaId) {
      setConversaId(novaConversaId());
      setMessages([BOAS_VINDAS]);
    }
  }, [conversaId]);

  const finalizeMessage = useCallback((id: string, text: string, model: string) => {
    setMessages((prev) =>
      prev.map((m) => m.id === id ? { ...m, text: text || m.text, streaming: false, model } : m)
    );
  }, []);

  const comando = useCallback(async (nome: string, args: string, textoOriginal: string) => {
    const id = Date.now();
    setMessages((prev) => [...prev, { id: "u-" + id, role: "user", text: textoOriginal }]);
    setInput("");
    let resposta: Message = { id: "a-" + id, role: "assistant", text: "", model: "CORTEX · comando" };
    try {
      if (nome === "imagem") {
        if (!args) throw new Error("Escreva o que quer ver. Ex.: /imagem um gato astronauta, estilo ilustração");
        resposta = { ...resposta, text: `Imagem gerada para: ${args}\n(gerador grátis; se não aparecer, tente de novo em alguns segundos)`, imagem: urlImagem(args), model: "Imagem grátis" };
      } else if (["agenda", "agendar", "drive"].includes(nome)) {
        if (!google) throw new Error("O Google ainda não está conectado. Abra Conexões > Google e siga os passos.");
        if (nome === "agenda") {
          const dias = Math.min(Math.max(parseInt(args, 10) || 7, 1), 60);
          resposta.text = `Seus compromissos nos próximos ${dias} dia(s):\n${textoAgenda(await listarAgenda(google, dias))}`;
        } else if (nome === "agendar") {
          const c = lerComandoAgendar(args);
          if (!c) throw new Error("Use: /agendar 2026-10-10 15:00 | Título do compromisso");
          const ev = await criarEvento(google, c);
          resposta.text = `Compromisso criado: ${ev.titulo}, ${new Date(ev.inicio).toLocaleString("pt-BR")}.`;
        } else {
          if (!args) throw new Error("Diga o que procurar. Ex.: /drive contrato");
          const arqs = await buscarDrive(google, args);
          if (!arqs.length) resposta.text = "Não achei nada no seu Drive com esse termo.";
          else {
            let texto = "Achei no seu Drive:\n" + arqs.map((a) => `• ${a.nome} (${new Date(a.atualizado).toLocaleDateString("pt-BR")}) ${a.link}`).join("\n");
            try {
              const conteudo = await lerDrive(google, arqs[0].id);
              texto += `\n\nComeço de "${arqs[0].nome}":\n${conteudo.slice(0, 800)}`;
            } catch { /* ignore */ }
            resposta.text = texto;
          }
        }
        resposta.model = "Google";
      } else {
        throw new Error("Comandos: /imagem, /agenda, /agendar, /drive");
      }
    } catch (err) {
      resposta.text = "⚠️ " + (err instanceof Error ? err.message : "Não consegui fazer isso agora.");
    }
    setMessages((prev) => [...prev, resposta]);
  }, [google]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setErrorBanner(null);
    setServerStarting(false);
    const cmd = text.trim().match(/^\/(\w+)\s*([\s\S]*)$/);
    if (cmd) {
      await comando(cmd[1].toLowerCase(), cmd[2].trim(), text.trim());
      return;
    }
    let extra = "";
    if (google && parecePerguntaDeAgenda(text)) {
      try {
        extra = `[Agenda real do usuário, próximos 7 dias]\n${textoAgenda(await listarAgenda(google, 7))}`;
      } catch { /* ignore */ }
    }

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
        {
          message: montarPrompt({
            pergunta: text,
            instrucoes: [obterProjeto(projetoId)?.instrucoes, extra].filter(Boolean).join("\n\n"),
            anteriores: messages.filter((m) => m.id !== "welcome" && !m.streaming),
          }),
          model: selectedModel,
          tenantId: "nexia",
        },
        abortRef.current.signal
      );

      for await (const chunk of gen) {
        if (chunk.token) {
          fullText += chunk.token;
        }
        if (chunk.model) {
          modelUsed = chunk.model;
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, text: fullText, model: modelUsed, streaming: !chunk.done }
              : m
          )
        );
        if (chunk.done) {
          receivedDone = true;
          break;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro de rede";
      if (!msg.includes("abort") && !msg.includes("cancel")) {
        if (!fullText) {
          setServerStarting(true);
          setErrorBanner("Servidor inicializando. Aguarde alguns segundos e tente novamente.");
          fullText = "⏳ Servidor acordando... O primeiro acesso pode levar alguns segundos. Aguarde e envie sua mensagem novamente.";
          modelUsed = "Offline";
        } else {
          setErrorBanner("Erro de streaming: " + msg);
        }
      }
    }

    if (!receivedDone) {
      finalizeMessage(assistantId, fullText, modelUsed);
    }

    setLoading(false);
    abortRef.current = null;
  }, [loading, selectedModel, finalizeMessage, messages, projetoId, google, comando]);

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setMessages((prev) =>
      prev.map((m) => m.streaming ? { ...m, streaming: false } : m)
    );
  }, []);

  return (
    <ThemeContext.Provider value={theme}>
      <div className={cn("min-h-screen bg-[#0a0a0f] text-white flex flex-col")}>
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
              <button onClick={novaConversa} disabled={loading} title="Nova conversa"
                className="px-2.5 py-1.5 text-xs rounded-lg bg-nexia-surface border border-nexia-border text-nexia-muted hover:text-white cursor-pointer disabled:opacity-40">
                <i className="ri-add-line" /> Nova
              </button>
              <button onClick={() => { setConversas(listarConversas()); setHistoricoAberto((v) => !v); }} title="Histórico de conversas"
                className="px-2.5 py-1.5 text-xs rounded-lg bg-nexia-surface border border-nexia-border text-nexia-muted hover:text-white cursor-pointer">
                <i className="ri-history-line" /> Histórico ({conversas.length})
              </button>
              <button onClick={() => setConexoesAberto((v) => !v)} title="Conexões com outros apps"
                className="px-2.5 py-1.5 text-xs rounded-lg bg-nexia-surface border border-nexia-border text-nexia-muted hover:text-white cursor-pointer">
                <i className="ri-plug-line" /> Conexões
              </button>
              <span className={`w-2 h-2 rounded-full ${loading ? "bg-amber-400 animate-pulse" : "bg-nexia-cyan animate-pulse"}`} />
              <span className="text-xs text-nexia-cyan">{loading ? "Processando..." : "Online"}</span>
            </div>
          </div>
        </header>

        {conexoesAberto && (
          <div className="border-b border-nexia-border bg-nexia-surface">
            <div className="max-w-6xl mx-auto px-4 md:px-8 py-3 space-y-2">
              {conexoes.length === 0 && <p className="text-xs text-nexia-muted">Verificando...</p>}
              {conexoes.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-lg border border-nexia-border px-3 py-2">
                  <span className={`w-2 h-2 rounded-full ${c.estado === "ativa" ? "bg-emerald-400" : "bg-red-400"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">{c.nome} <span className="text-[10px] text-nexia-muted">{c.estado === "ativa" ? "ativa" : "fora do ar"} · {c.detalhe}</span></p>
                    <p className="text-[11px] text-nexia-muted">{c.descricao}</p>
                  </div>
                </div>
              ))}
              <div className="rounded-lg border border-nexia-border px-3 py-2 space-y-2">
                <p className="text-sm text-white">
                  <i className="ri-google-line text-nexia-cyan" /> Google (Agenda e Drive){" "}
                  <span className="text-[10px] text-nexia-muted">{google ? "conectado" : "não conectado"}</span>
                </p>
                <input value={googleForm.url} onChange={(e) => setGoogleForm({ ...googleForm, url: e.target.value })} placeholder="Endereço da ponte (termina em /exec)"
                  className="w-full px-3 py-2 text-xs bg-nexia-surface2 border border-nexia-border rounded-lg text-white outline-none" />
                <input type="password" value={googleForm.segredo} onChange={(e) => setGoogleForm({ ...googleForm, segredo: e.target.value })} placeholder="Senha da ponte"
                  className="w-full px-3 py-2 text-xs bg-nexia-surface2 border border-nexia-border rounded-lg text-white outline-none" />
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={async () => {
                    setGoogleMsg("Testando...");
                    try {
                      const quem = await testarGoogle(googleForm);
                      salvarConfigGoogle(googleForm);
                      setGoogle({ url: googleForm.url.trim(), segredo: googleForm.segredo.trim() });
                      setGoogleMsg("Conectado como " + quem + ".");
                    } catch (err) {
                      setGoogleMsg("⚠️ " + (err instanceof Error ? err.message : "Falhou."));
                    }
                  }} className="px-3 py-1.5 text-xs rounded-lg bg-nexia-cyan text-[#0a0a0f] cursor-pointer">Testar e salvar</button>
                  {google && (
                    <button onClick={() => { salvarConfigGoogle(null); setGoogle(null); setGoogleForm({ url: "", segredo: "" }); setGoogleMsg("Desconectado."); }}
                      className="px-3 py-1.5 text-xs rounded-lg border border-nexia-border text-nexia-muted hover:text-red-400 cursor-pointer">Desconectar</button>
                  )}
                  {googleMsg && <span className="text-[11px] text-nexia-muted">{googleMsg}</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {historicoAberto && (
          <div className="border-b border-nexia-border bg-nexia-surface max-h-64 overflow-y-auto">
            <div className="max-w-6xl mx-auto px-4 md:px-8 py-3 space-y-1">
              <div className="flex flex-wrap items-center gap-2 pb-2">
                <span className="text-[10px] uppercase tracking-wider text-nexia-muted">Projeto</span>
                <select value={projetoId} onChange={(e) => setProjetoId(e.target.value)}
                  className="px-2 py-1 text-xs bg-nexia-surface2 border border-nexia-border rounded-lg text-white outline-none">
                  <option value="">Sem projeto</option>
                  {projetos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
                <button onClick={() => setEditando({ nome: "", instrucoes: "" })} className="px-2 py-1 text-xs rounded-lg border border-nexia-border text-nexia-muted hover:text-white cursor-pointer">
                  <i className="ri-folder-add-line" /> Novo projeto
                </button>
              </div>
              {editando && (
                <div className="rounded-lg border border-nexia-cyan/30 p-3 mb-2 space-y-2">
                  <input value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} placeholder="Nome do projeto"
                    className="w-full px-3 py-2 text-sm bg-nexia-surface2 border border-nexia-border rounded-lg text-white outline-none" />
                  <textarea value={editando.instrucoes} onChange={(e) => setEditando({ ...editando, instrucoes: e.target.value })} rows={4}
                    placeholder="Instruções para o projeto"
                    className="w-full px-3 py-2 text-sm bg-nexia-surface2 border border-nexia-border rounded-lg text-white outline-none" />
                  <div className="flex gap-2">
                    <button onClick={() => { const p = salvarProjeto(editando); setProjetos(listarProjetos()); setProjetoId(p.id); setEditando(null); }}
                      className="px-3 py-1.5 text-xs rounded-lg bg-nexia-cyan text-[#0a0a0f] cursor-pointer">Salvar projeto</button>
                    <button onClick={() => setEditando(null)} className="px-3 py-1.5 text-xs rounded-lg border border-nexia-border text-nexia-muted cursor-pointer">Cancelar</button>
                  </div>
                </div>
              )}
              {conversas.map((c) => (
                <div key={c.id} className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${c.id === conversaId ? "border-nexia-cyan/40" : "border-nexia-border"}`}>
                  <button onClick={() => abrirConversa(c.id)} className="flex-1 text-left text-sm text-white truncate cursor-pointer">
                    {c.titulo}
                    <span className="block text-[10px] text-nexia-muted">{new Date(c.atualizadaEm).toLocaleString("pt-BR")}</span>
                  </button>
                  <button onClick={() => excluirConversa(c.id)} title="Apagar conversa" className="text-nexia-muted hover:text-red-400 cursor-pointer">
                    <i className="ri-delete-bin-line" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
          <Sidebar />
          <ChatArea
            messages={messages}
            input={input}
            setInput={setInput}
            loading={loading}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            MODEL_OPTIONS={MODEL_OPTIONS}
            CHIPS={CHIPS}
            send={send}
            stopStream={stopStream}
            serverStarting={serverStarting}
            setServerStarting={setServerStarting}
            errorBanner={errorBanner}
            setErrorBanner={setErrorBanner}
            bottomRef={bottomRef}
          />
          <PreviewPanel />
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  useEffect(() => {
    // Sincroniza tema com o documento ou classes
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      <div className={cn("min-h-screen flex flex-col md:flex-row bg-[#0a0a0f] text-white transition-colors duration-200", theme === 'light' ? 'bg-gray-50 text-gray-900' : '')}>
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 flex flex-col min-w-0 relative">
          <ChatArea 
            onOpenPreview={(content) => {
              setPreviewContent(content);
              setPreviewOpen(true);
            }} 
          />
        </main>
        {previewOpen && (
          <PreviewPanel 
            content={previewContent} 
            onClose={() => setPreviewOpen(false)} 
          />
        )}
      </div>
    </ThemeContext.Provider>
  );
}
