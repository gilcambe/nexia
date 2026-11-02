import { useEffect, useRef, useState } from "react";
import { streamCortex } from "@/services/api";
import { apiPath } from "@/config/env";
import { useAuth } from "@/contexts/AuthContext";
import { contextoCentral, ehSobreSituacao } from "./intencao";
import type { SituacaoCortex } from "./intencao";
import Logo from "./Logo";
import Composer from "./Composer";
import MarkdownRenderer from "../../components/MarkdownRenderer";
import { falarTexto } from "@/lib/voz";
import { usePedidos } from "../meu-cortex/api";
import { lerConfig, salvarConfig, suporte, carregar, pronto, responderNoAparelho, MODELOS } from "@/lib/ia-aparelho";

// Pergunta direta ao Cortex: a resposta chega palavra por palavra (SSE do Worker em /api/cortex), sem abrir pedido.
// Para mudar código, "Virar pedido" manda a pergunta para a fila do Cortex como um pedido normal.
// #1816: o texto da resposta passa pelo Markdown (negrito, listas, tabelas, código).
// #1640: resposta que é só uma imagem gerada (markdown ![..](data:image/...)) aparece como imagem.
const imagemDe = (t: string): string | null => (/^!\[[^\]]*\]\((data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+)\)$/.exec((t || "").trim()) || [])[1] || null;
interface Fala { id: string; quem: "dono" | "cortex"; texto: string; vivo?: boolean; modelo?: string }

// #823: "como estamos?" / "o que falta?" leem a Central (fila do Cortex) antes de responder. Sem acesso, responde sem esse contexto.
// #826 / #1656: modo "Pesquisar" busca na web (grátis, pelo servidor em /api/cortex) e a resposta cita as fontes reais.
async function lerCentral(token: string | null): Promise<string> {
  if (!token) return "";
  try {
    const r = await fetch(apiPath("/central") + "?parte=cortex", { headers: { Authorization: `Bearer ${token}` } });
    return r.ok ? contextoCentral((await r.json()) as SituacaoCortex) : "";
  } catch { return ""; }
}

export default function Pergunta({ virarPedido, primeira }: { virarPedido: (texto: string) => void; primeira?: string }) {
  const { getToken } = useAuth();
  const { agir } = usePedidos();
  const [falas, setFalas] = useState<Fala[]>([]);
  const [conversa] = useState(() => "cortex-app-" + Date.now().toString(36));
  const corte = useRef<AbortController | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const respondendo = falas.some((f) => f.vivo);
  const [modoConversa, setModoConversa] = useState(false);
  const [statusVoz, setStatusVoz] = useState<string | null>(null);
  const [falandoId, setFalandoId] = useState<string | null>(null);
  // #2856: "IA no meu aparelho" (WebLLM). Pergunta curta é respondida aqui, sem gastar cota; o resto vai para a nuvem.
  const [aparelho, setAparelho] = useState(() => lerConfig());
  const [statusAparelho, setStatusAparelho] = useState<string | null>(null);
  useEffect(() => { if (aparelho.ativo && !pronto()) void ligarAparelho(aparelho.modelo, true); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function ligarAparelho(modelo: string, silencioso = false) {
    const s = await suporte();
    if (!s.ok) { salvarConfig({ ativo: false, modelo }); setAparelho({ ativo: false, modelo }); setStatusAparelho(silencioso ? null : s.motivo || "Este aparelho não aguenta."); return; }
    salvarConfig({ ativo: true, modelo }); setAparelho({ ativo: true, modelo });
    try {
      await carregar(modelo, (pct) => setStatusAparelho(`Baixando a IA no aparelho: ${pct}% (só na primeira vez)`));
      setStatusAparelho("IA no aparelho pronta ✅");
      setTimeout(() => setStatusAparelho(null), 3000);
    } catch { setStatusAparelho("Não consegui baixar a IA no aparelho. As respostas seguem pela nuvem."); }
  }
  const alternarAparelho = () => {
    if (aparelho.ativo) { salvarConfig({ ...aparelho, ativo: false }); setAparelho({ ...aparelho, ativo: false }); setStatusAparelho(null); return; }
    void ligarAparelho(aparelho.modelo);
  };
  const modoConversaRef = useRef(modoConversa);
  modoConversaRef.current = modoConversa;

  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [falas]);
  useEffect(() => () => corte.current?.abort(), []);
  // Pergunta que chegou pelo "Pedir tarefa" (#823): responde na hora, sem abrir issue.
  const feita = useRef(false);
  useEffect(() => { if (primeira && !feita.current) { feita.current = true; void perguntar(primeira); } }, [primeira]); // eslint-disable-line react-hooks/exhaustive-deps

  const perguntar = async (texto: string, modo?: "rapido" | "pensar" | "pesquisar"): Promise<string> => {
    const id = "c" + Date.now();
    let textoFinal = "";
    setFalas((l) => [...l, { id: "d" + Date.now(), quem: "dono", texto }, { id, quem: "cortex", texto: "pensando...", vivo: true }]);
    const ctl = new AbortController();
    corte.current = ctl;
    const mudar = (f: (x: Fala) => Fala) => setFalas((l) => l.map((x) => (x.id === id ? f(x) : x)));
    try {
      if (aparelho.ativo && pronto() && !ehSobreSituacao(texto)) {
        const local = await responderNoAparelho(texto, modo);
        if (local) { textoFinal = local; mudar((x) => ({ ...x, texto: local, modelo: "no seu aparelho (grátis)" })); return textoFinal; }
      }
      const token = ehSobreSituacao(texto) ? await getToken().catch(() => null) : null;
      const ctx = ehSobreSituacao(texto) ? await lerCentral(token) : "";
      const message = ctx ? `${ctx}\n\nPergunta do dono: ${texto}` : texto;
      for await (const c of streamCortex({ message, tenantId: "nexia", conversationId: conversa, modo }, ctl.signal)) {
        if (typeof c.token === "string" && c.token) {
          const tok = c.token;
          mudar((x) => {
            const novo = x.texto === "pensando..." ? tok : x.texto + tok;
            textoFinal = novo;
            return { ...x, texto: novo };
          });
        }
        if (c.model) mudar((x) => ({ ...x, modelo: c.model }));
        if (c.done) break;
      }
    } catch (e) {
      if (!ctl.signal.aborted) {
        const errTxt = `\n\n❌ ${(e as Error).message || "não consegui agora, tente de novo"}`;
        textoFinal += errTxt;
        mudar((x) => ({ ...x, texto: (x.texto === "pensando..." ? "" : x.texto) + errTxt }));
      }
    } finally {
      mudar((x) => {
        const limpo = !x.texto || x.texto === "pensando...";
        const txtFinal = limpo
          ? (ctl.signal.aborted ? "(parado)" : "não consegui agora, tente de novo")
          : x.texto;
        textoFinal = txtFinal;
        return { ...x, vivo: false, texto: txtFinal };
      });
      corte.current = null;
    }
    return textoFinal;
  };

  const ouvirETraduzirVoz = async (): Promise<string | null> => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return null;
    try {
      setStatusVoz("Ouvindo você… pode falar!");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const mr = new MediaRecorder(stream);
      return await new Promise<string | null>((resolve) => {
        mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        mr.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
          if (blob.size < 100) { resolve(null); return; }
          setStatusVoz("Transcrevendo seu áudio…");
          try {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
              const b64 = String(reader.result || "").split(",")[1];
              if (!b64) { resolve(null); return; }
              const res = await agir({ acao: "entender", nome: "voz.webm", tipo: blob.type, base64: b64 }) as { ok: boolean; texto?: string };
              resolve(res?.ok && res.texto ? res.texto : null);
            };
          } catch { resolve(null); }
        };
        mr.start();
        // Grava por 6 segundos ou para se o modo conversa for cancelado
        setTimeout(() => { if (mr.state !== "inactive") mr.stop(); }, 6000);
      });
    } catch {
      setStatusVoz(null);
      return null;
    }
  };

  const alternarModoConversa = async () => {
    if (modoConversaRef.current) {
      modoConversaRef.current = false;
      setModoConversa(false);
      setStatusVoz(null);
      return;
    }
    modoConversaRef.current = true;
    setModoConversa(true);
    // Ciclo contínuo do Modo Conversa:
    // Fala -> Ouve -> Transcreve -> Cortex responde -> Lê resposta -> Repete sem tocar na tela
    while (modoConversaRef.current) {
      const transcricao = await ouvirETraduzirVoz();
      if (!modoConversaRef.current) break;
      if (transcricao && transcricao.trim()) {
        setStatusVoz("Cortex pensando…");
        const respTexto = await perguntar(transcricao.trim());
        if (!modoConversaRef.current) break;
        if (respTexto) {
          setStatusVoz("Cortex falando a resposta…");
          await falarTexto(respTexto, getToken);
        }
      } else {
        setStatusVoz("Não ouvi nada. Diga algo…");
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    setStatusVoz(null);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col" data-testid="cx-pergunta">
      <div className="px-4 py-2 border-b border-[var(--cx-line)] flex items-center justify-between bg-[var(--cx-card)] shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={alternarModoConversa}
            data-testid="cx-modo-conversa"
            className={`h-9 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
              modoConversa ? "bg-red-500 text-white animate-pulse" : "border border-[var(--cx-line)] text-[var(--cx-txt)] hover:bg-[var(--cx-hover)]"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
            <span>{modoConversa ? "Parar Modo Conversa" : "Ativar Modo Conversa"}</span>
          </button>
          <button
            type="button"
            onClick={alternarAparelho}
            data-testid="cx-ia-aparelho"
            title="Perguntas curtas respondidas pela placa de vídeo do seu aparelho, sem gastar cota"
            className={`h-9 px-3 rounded-xl text-xs font-semibold transition-colors ${aparelho.ativo ? "bg-[var(--cx-ac)] text-black" : "border border-[var(--cx-line)] text-[var(--cx-txt)] hover:bg-[var(--cx-hover)]"}`}
          >
            🖥 {aparelho.ativo ? "IA no aparelho: ligada" : "IA no meu aparelho (grátis)"}
          </button>
          {aparelho.ativo && (
            <select aria-label="Tamanho da IA no aparelho" data-testid="cx-ia-aparelho-modelo" value={aparelho.modelo}
              onChange={(e) => void ligarAparelho(e.target.value)}
              className="h-9 px-2 rounded-xl border border-[var(--cx-line)] bg-transparent text-xs">
              <option value={MODELOS.leve}>Leve (celular)</option>
              <option value={MODELOS.normal}>Normal (PC)</option>
            </select>
          )}
          {statusAparelho && <span className="text-xs text-[var(--cx-mut)] truncate" data-testid="cx-ia-aparelho-status">{statusAparelho}</span>}
          {statusVoz && <span className="text-xs text-[var(--cx-ac)] animate-pulse truncate" data-testid="cx-status-voz">{statusVoz}</span>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-5">
          {falas.length === 0 && (
            <div className="flex flex-col items-center text-center pt-10 gap-3">
              <Logo tamanho={64} />
              <p className="text-sm text-[var(--cx-mut)] max-w-sm">Pergunte e veja a resposta chegando na hora. Para mudar código, use “Virar pedido”.</p>
            </div>
          )}
          {falas.map((f, k) => f.quem === "dono" ? (
            <div key={f.id} className="flex justify-end">
              <div className="max-w-[88%] rounded-3xl rounded-br-md px-4 py-3 bg-[var(--cx-user)]">
                <p className="whitespace-pre-wrap break-words text-[15px] leading-6">{f.texto}</p>
              </div>
            </div>
          ) : (
            <div key={f.id} className="flex gap-3" data-testid="cx-resposta">
              <Logo tamanho={32} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[var(--cx-mut)] mb-1">Cortex{f.modelo ? ` · ${f.modelo}` : ""}{f.vivo ? " · escrevendo…" : ""}</p>
                <div className="break-words text-[15px] leading-6" aria-live="polite" aria-busy={f.vivo ? "true" : "false"} data-testid="cx-resposta-texto">
                  {imagemDe(f.texto) ? <img src={imagemDe(f.texto)!} alt="Imagem criada pelo Cortex" className="rounded-2xl max-w-full w-[512px]" data-testid="cx-imagem" /> : <MarkdownRenderer markdown={f.texto} />}
                  {f.vivo && <span className="inline-block w-2 h-4 align-middle ml-0.5 bg-[var(--cx-ac)] animate-pulse" />}
                </div>
                {!f.vivo && f.texto && (
                  <button
                    type="button"
                    onClick={async () => {
                      setFalandoId(f.id);
                      await falarTexto(f.texto, getToken);
                      setFalandoId(null);
                    }}
                    data-testid={`cx-falar-${f.id}`}
                    aria-label="Ouvir resposta em voz alta"
                    className={`mt-2 text-xs flex items-center gap-1 text-[var(--cx-mut)] hover:text-[var(--cx-txt)] ${falandoId === f.id ? "text-[var(--cx-ac)] animate-pulse" : ""}`}
                  >
                    🔊 {falandoId === f.id ? "Lendo em voz alta…" : "Ouvir resposta"}
                  </button>
                )}
                {f.vivo && <button onClick={() => corte.current?.abort()} className="mt-2 h-9 px-3 rounded-xl border border-[var(--cx-line)] text-xs" data-testid="cx-parar">Parar</button>}
                {!f.vivo && k > 0 && (
                  <div className="flex gap-2 mt-2">
                    {(f.texto.includes("não consegui agora") || f.texto.includes("tente de novo") || f.texto === "(parado)") && (
                      <button onClick={() => perguntar(falas[k - 1].texto)} className="h-9 px-3 rounded-xl bg-[var(--cx-ac)] text-black font-semibold text-xs" data-testid="cx-tentar-novamente">Tentar de novo</button>
                    )}
                    <button onClick={() => virarPedido(falas[k - 1].texto)} className="h-9 px-3 rounded-xl border border-[var(--cx-line)] text-xs" data-testid="cx-virar-pedido">Virar pedido</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={fim} />
        </div>
      </div>
      <Composer modo="pergunta" enviar={async (t, m) => { if (respondendo) throw new Error("Espere a resposta terminar ou toque em Parar."); void perguntar(t, m); }} />
    </div>
  );
}
