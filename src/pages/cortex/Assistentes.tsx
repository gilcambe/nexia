import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

export interface KnowledgeFile {
  fileName: string;
  content: string;
}

export interface Assistant {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  systemPrompt?: string;
  icon?: string;
  preset?: boolean;
  global?: boolean;
  knowledgeFiles?: { fileName: string; size: number }[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function Assistentes() {
  const [assistentes, setAssistentes] = useState<Assistant[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Form de criação
  const [modalCriar, setModalCriar] = useState(false);
  const [nome, setNome] = useState("");
  const [fotoIcone, setFotoIcone] = useState("🤖");
  const [descricao, setDescricao] = useState("");
  const [instrucoes, setInstrucoes] = useState("");
  const [arquivos, setArquivos] = useState<KnowledgeFile[]>([]);
  const [novoNomeArq, setNovoNomeArq] = useState("");
  const [novoConteudoArq, setNovoConteudoArq] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Modal de conversa
  const [assistenteAtivo, setAssistenteAtivo] = useState<Assistant | null>(null);
  const [mensagens, setMensagens] = useState<ChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/agents?tenantId=nexia");
      const data = await res.json();
      if (data.agents) {
        setAssistentes(data.agents);
      }
    } catch (e) {
      setErro("Falha ao carregar assistentes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const adicionarArquivo = () => {
    if (!novoNomeArq.trim() || !novoConteudoArq.trim()) return;
    if (arquivos.length >= 5) {
      alert("Máximo de 5 arquivos por assistente.");
      return;
    }
    setArquivos([...arquivos, { fileName: novoNomeArq.trim(), content: novoConteudoArq.trim() }]);
    setNovoNomeArq("");
    setNovoConteudoArq("");
  };

  const removerArquivo = (idx: number) => {
    setArquivos(arquivos.filter((_, i) => i !== idx));
  };

  const criarAssistente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !instrucoes.trim()) {
      alert("Preencha nome e instruções do assistente.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nome,
          displayName: nome,
          description: descricao || "Assistente customizado",
          systemPrompt: instrucoes,
          icon: fotoIcone || "🤖",
          tenantId: "nexia",
          knowledgeFiles: arquivos
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Erro ao criar assistente");
      }
      setModalCriar(false);
      setNome("");
      setFotoIcone("🤖");
      setDescricao("");
      setInstrucoes("");
      setArquivos([]);
      carregar();
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const excluirAssistente = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este assistente?")) return;
    try {
      const res = await fetch(`/api/agents?id=${id}&tenantId=nexia`, { method: "DELETE" });
      if (res.ok) carregar();
    } catch {
      alert("Erro ao excluir assistente");
    }
  };

  const copiarLinkPublico = (id: string) => {
    const url = `${window.location.origin}/cortex/a/${id}`;
    navigator.clipboard.writeText(url);
    setCopiadoId(id);
    setTimeout(() => setCopiadoId(null), 2500);
  };

  const abrirChat = (ast: Assistant) => {
    setAssistenteAtivo(ast);
    setMensagens([
      { role: "assistant", content: `Olá! Sou ${ast.displayName || ast.name}. Como posso ajudar você hoje?` }
    ]);
  };

  const enviarMensagem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || !assistenteAtivo || enviando) return;

    const texto = inputMsg;
    setInputMsg("");
    const novasMsgs: ChatMessage[] = [...mensagens, { role: "user", content: texto }];
    setMensagens(novasMsgs);
    setEnviando(true);

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          agentId: assistenteAtivo.id,
          message: texto,
          tenantId: "nexia",
          history: novasMsgs
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setMensagens([...novasMsgs, { role: "assistant", content: `⚠️ ${data.error || "Limite ou erro ao responder"}` }]);
      } else {
        setMensagens([...novasMsgs, { role: "assistant", content: data.reply }]);
      }
    } catch {
      setMensagens([...novasMsgs, { role: "assistant", content: "❌ Falha na conexão com o assistente." }]);
    } finally {
      setEnviando(false);
    }
  };

  const prontos = assistentes.filter(a => a.preset || a.global);
  const meus = assistentes.filter(a => !a.preset && !a.global);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Meus Assistentes</h2>
          <p className="text-sm text-[var(--cx-mut)]">Crie assistentes personalizados (estilo GPTs) com instruções e conhecimento do seu negócio.</p>
        </div>
        <button
          onClick={() => setModalCriar(true)}
          className="h-11 px-5 rounded-xl bg-[var(--cx-ac)] text-black font-semibold flex items-center gap-2 hover:opacity-90"
          data-testid="cx-criar-assistente"
        >
          <span>+ Criar assistente</span>
        </button>
      </header>

      {erro && <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-sm">{erro}</div>}

      {/* Seção 1: Assistentes Prontos */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span>⚡ 10 Assistentes Prontos</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {prontos.map(ast => (
            <div key={ast.id} className="p-4 rounded-2xl border border-[var(--cx-line)] bg-[var(--cx-card)] flex flex-col justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="text-3xl p-2 rounded-xl bg-[var(--cx-hover)] shrink-0">{ast.icon || "🤖"}</span>
                <div>
                  <h4 className="font-semibold text-[15px]">{ast.displayName || ast.name}</h4>
                  <p className="text-xs text-[var(--cx-mut)] mt-1 line-clamp-2">{ast.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-[var(--cx-line)]">
                <button
                  onClick={() => abrirChat(ast)}
                  className="flex-1 h-9 rounded-lg bg-[var(--cx-hover)] text-xs font-semibold hover:bg-[var(--cx-line)]"
                  data-testid={`cx-usar-${ast.id}`}
                >
                  Conversar agora
                </button>
                <button
                  onClick={() => copiarLinkPublico(ast.id)}
                  className="h-9 px-3 rounded-lg border border-[var(--cx-line)] text-xs hover:bg-[var(--cx-hover)]"
                  title="Copiar link público"
                >
                  {copiadoId === ast.id ? "✓ Copiado" : "🔗 Link"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Seção 2: Meus Assistentes Criados */}
      <section className="space-y-3 pt-4">
        <h3 className="text-lg font-semibold">🎨 Assistentes Personalizados</h3>
        {loading && <p className="text-sm text-[var(--cx-mut)] animate-pulse">Carregando seus assistentes...</p>}
        {!loading && meus.length === 0 && (
          <div className="p-8 rounded-2xl border border-dashed border-[var(--cx-line)] text-center space-y-2">
            <p className="text-sm text-[var(--cx-mut)]">Você ainda não criou nenhum assistente personalizado.</p>
            <button
              onClick={() => setModalCriar(true)}
              className="text-xs text-[var(--cx-ac)] font-semibold underline"
            >
              Criar meu primeiro assistente
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {meus.map(ast => (
            <div key={ast.id} className="p-4 rounded-2xl border border-[var(--cx-line)] bg-[var(--cx-card)] flex flex-col justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="text-3xl p-2 rounded-xl bg-[var(--cx-hover)] shrink-0">{ast.icon || "🤖"}</span>
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-[15px] truncate">{ast.displayName || ast.name}</h4>
                  <p className="text-xs text-[var(--cx-mut)] mt-1 line-clamp-2">{ast.description || ast.systemPrompt}</p>
                  {ast.knowledgeFiles && ast.knowledgeFiles.length > 0 && (
                    <span className="inline-block mt-2 text-[11px] px-2 py-0.5 rounded bg-[var(--cx-hover)] text-[var(--cx-ac)]">
                      📁 {ast.knowledgeFiles.length} arquivo(s) de conhecimento
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-[var(--cx-line)]">
                <button
                  onClick={() => abrirChat(ast)}
                  className="flex-1 h-9 rounded-lg bg-[var(--cx-ac)] text-black text-xs font-semibold hover:opacity-90"
                >
                  Conversar
                </button>
                <button
                  onClick={() => copiarLinkPublico(ast.id)}
                  className="h-9 px-3 rounded-lg border border-[var(--cx-line)] text-xs hover:bg-[var(--cx-hover)]"
                  title="Copiar link público para clientes"
                >
                  {copiadoId === ast.id ? "✓ Copiado" : "🔗 Compartilhar"}
                </button>
                <button
                  onClick={() => excluirAssistente(ast.id)}
                  className="h-9 px-2.5 rounded-lg border border-red-900/50 text-red-400 text-xs hover:bg-red-950/30"
                  title="Excluir assistente"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Modal Criar Assistente */}
      {modalCriar && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[var(--cx-card)] border border-[var(--cx-line)] rounded-2xl w-full max-w-lg p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-[var(--cx-line)] pb-3">
              <h3 className="text-lg font-bold">Criar Assistente Personalizado</h3>
              <button onClick={() => setModalCriar(false)} className="text-[var(--cx-mut)] hover:text-white">✕</button>
            </div>
            <form onSubmit={criarAssistente} className="space-y-4 text-sm">
              <div className="flex gap-3">
                <div className="w-20">
                  <label className="block text-xs font-medium text-[var(--cx-mut)] mb-1">Ícone</label>
                  <input
                    type="text"
                    value={fotoIcone}
                    onChange={e => setFotoIcone(e.target.value)}
                    placeholder="🍕"
                    className="w-full h-10 text-center text-xl rounded-xl border border-[var(--cx-line)] bg-[var(--cx-bg)] text-[var(--cx-txt)]"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-[var(--cx-mut)] mb-1">Nome do Assistente *</label>
                  <input
                    type="text"
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    placeholder="Ex: Atendente Pizzaria Bella"
                    required
                    className="w-full h-10 px-3 rounded-xl border border-[var(--cx-line)] bg-[var(--cx-bg)] text-[var(--cx-txt)] outline-none focus:border-[var(--cx-ac)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--cx-mut)] mb-1">Descrição Curta</label>
                <input
                  type="text"
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  placeholder="Ex: Tira dúvidas de cardápio e preços"
                  className="w-full h-10 px-3 rounded-xl border border-[var(--cx-line)] bg-[var(--cx-bg)] text-[var(--cx-txt)] outline-none focus:border-[var(--cx-ac)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--cx-mut)] mb-1">Instruções do Assistente (Prompt) *</label>
                <textarea
                  value={instrucoes}
                  onChange={e => setInstrucoes(e.target.value)}
                  placeholder="Ex: Você é o atendente da minha pizzaria. Responda sobre sabores, preços e promoções com tom simpático..."
                  rows={3}
                  required
                  className="w-full p-3 rounded-xl border border-[var(--cx-line)] bg-[var(--cx-bg)] text-[var(--cx-txt)] outline-none focus:border-[var(--cx-ac)]"
                />
              </div>

              {/* Conhecimento / Arquivos RAG */}
              <div className="space-y-2 pt-2 border-t border-[var(--cx-line)]">
                <label className="block text-xs font-semibold text-[var(--cx-txt)]">
                  📁 Arquivos de Conhecimento RAG (Até 5 arquivos)
                </label>
                <p className="text-xs text-[var(--cx-mut)]">Cole cardápios, tabela de preços ou manuais para indexação RAG.</p>

                {arquivos.map((arq, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-[var(--cx-bg)] border border-[var(--cx-line)] text-xs">
                    <span className="font-mono truncate">{arq.fileName} ({arq.content.length} chars)</span>
                    <button type="button" onClick={() => removerArquivo(idx)} className="text-red-400 font-bold px-2">✕</button>
                  </div>
                ))}

                {arquivos.length < 5 && (
                  <div className="space-y-2 p-3 rounded-xl bg-[var(--cx-bg)] border border-[var(--cx-line)]">
                    <input
                      type="text"
                      value={novoNomeArq}
                      onChange={e => setNovoNomeArq(e.target.value)}
                      placeholder="Nome do arquivo (ex: cardapio.txt)"
                      className="w-full h-9 px-3 rounded-lg border border-[var(--cx-line)] bg-[var(--cx-card)] text-xs"
                    />
                    <textarea
                      value={novoConteudoArq}
                      onChange={e => setNovoConteudoArq(e.target.value)}
                      placeholder="Conteúdo do arquivo (ex: Pizza Margherita R$45, Pizza Calabresa R$50...)"
                      rows={2}
                      className="w-full p-2 rounded-lg border border-[var(--cx-line)] bg-[var(--cx-card)] text-xs"
                    />
                    <button
                      type="button"
                      onClick={adicionarArquivo}
                      className="h-8 px-3 rounded-lg bg-[var(--cx-hover)] border border-[var(--cx-line)] text-xs font-semibold hover:bg-[var(--cx-line)]"
                    >
                      + Anexar Conhecimento
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t border-[var(--cx-line)]">
                <button
                  type="button"
                  onClick={() => setModalCriar(false)}
                  className="flex-1 h-11 rounded-xl border border-[var(--cx-line)] font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 h-11 rounded-xl bg-[var(--cx-ac)] text-black font-semibold hover:opacity-90 disabled:opacity-50"
                  data-testid="cx-salvar-assistente"
                >
                  {salvando ? "Salvando..." : "Criar Assistente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Conversa no Dashboard */}
      {assistenteAtivo && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[var(--cx-card)] border border-[var(--cx-line)] rounded-2xl w-full max-w-xl h-[80vh] flex flex-col overflow-hidden">
            <header className="flex items-center justify-between px-4 h-14 border-b border-[var(--cx-line)] shrink-0 bg-[var(--cx-side)]">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{assistenteAtivo.icon || "🤖"}</span>
                <div>
                  <h3 className="font-semibold text-sm">{assistenteAtivo.displayName || assistenteAtivo.name}</h3>
                  <span className="text-[11px] text-[var(--cx-mut)]">Assistente ativo</span>
                </div>
              </div>
              <button onClick={() => setAssistenteAtivo(null)} className="text-[var(--cx-mut)] hover:text-white p-2">✕</button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {mensagens.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${m.role === "user" ? "bg-[var(--cx-ac)] text-black font-medium" : "bg-[var(--cx-bg)] border border-[var(--cx-line)] text-[var(--cx-txt)]"}`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {enviando && <p className="text-xs text-[var(--cx-mut)] animate-pulse">Assistente digitando...</p>}
            </div>

            <form onSubmit={enviarMensagem} className="p-3 border-t border-[var(--cx-line)] bg-[var(--cx-side)] flex gap-2">
              <input
                type="text"
                value={inputMsg}
                onChange={e => setInputMsg(e.target.value)}
                placeholder="Escreva sua mensagem..."
                className="flex-1 h-11 px-4 rounded-xl border border-[var(--cx-line)] bg-[var(--cx-bg)] text-sm outline-none focus:border-[var(--cx-ac)]"
              />
              <button
                type="submit"
                disabled={enviando || !inputMsg.trim()}
                className="h-11 px-5 rounded-xl bg-[var(--cx-ac)] text-black font-semibold disabled:opacity-50"
              >
                Enviar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Visualização de chat público (/cortex/a/:id)
export function AssistentePublico() {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<Assistant | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<ChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/agents?publicId=${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.agent) {
          setAgent(data.agent);
          setMensagens([{ role: "assistant", content: `Olá! Sou o ${data.agent.displayName || data.agent.name}. Como posso ajudar?` }]);
        } else {
          setErro("Assistente não encontrado.");
        }
      })
      .catch(() => setErro("Erro ao carregar assistente."))
      .finally(() => setLoading(false));
  }, [id]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || !agent || enviando) return;

    const texto = inputMsg;
    setInputMsg("");
    const novasMsgs: ChatMessage[] = [...mensagens, { role: "user", content: texto }];
    setMensagens(novasMsgs);
    setEnviando(true);

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publicChat",
          agentId: agent.id,
          message: texto,
          tenantId: "nexia",
          history: novasMsgs
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setMensagens([...novasMsgs, { role: "assistant", content: `⚠️ ${data.error || "Limite de mensagens atingido."}` }]);
      } else {
        setMensagens([...novasMsgs, { role: "assistant", content: data.reply }]);
      }
    } catch {
      setMensagens([...novasMsgs, { role: "assistant", content: "❌ Ocorreu um erro ao conectar ao assistente." }]);
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0b10] text-white flex items-center justify-center p-4">
        <p className="animate-pulse text-sm text-gray-400">Carregando assistente...</p>
      </div>
    );
  }

  if (erro || !agent) {
    return (
      <div className="min-h-screen bg-[#0b0b10] text-white flex flex-col items-center justify-center p-4 gap-3 text-center">
        <span className="text-4xl">🤖</span>
        <h1 className="text-xl font-bold">Assistente não disponível</h1>
        <p className="text-sm text-gray-400">{erro || "Não foi possível encontrar este assistente."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0b10] text-[#ececf1] flex flex-col max-w-xl mx-auto shadow-2xl border-x border-[#26262f]">
      <header className="flex items-center gap-3 px-4 h-16 border-b border-[#26262f] bg-[#101017]">
        <span className="text-3xl">{agent.icon || "🤖"}</span>
        <div>
          <h1 className="font-bold text-base">{agent.displayName || agent.name}</h1>
          <p className="text-xs text-[#9a9aa8]">{agent.description || "Assistente virtual Kernex"}</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {mensagens.map((m, idx) => (
          <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm ${m.role === "user" ? "bg-[#00d4aa] text-black font-medium" : "bg-[#16161f] border border-[#26262f] text-[#ececf1]"}`}>
              {m.content}
            </div>
          </div>
        ))}
        {enviando && <p className="text-xs text-[#9a9aa8] animate-pulse">Digitando...</p>}
      </div>

      <form onSubmit={enviar} className="p-3 border-t border-[#26262f] bg-[#101017] flex gap-2">
        <input
          type="text"
          value={inputMsg}
          onChange={e => setInputMsg(e.target.value)}
          placeholder="Envie uma mensagem..."
          className="flex-1 h-12 px-4 rounded-xl border border-[#26262f] bg-[#0b0b10] text-sm text-white outline-none focus:border-[#00d4aa]"
        />
        <button
          type="submit"
          disabled={enviando || !inputMsg.trim()}
          className="h-12 px-5 rounded-xl bg-[#00d4aa] text-black font-semibold disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
