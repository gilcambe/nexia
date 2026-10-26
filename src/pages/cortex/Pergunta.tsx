import { useEffect, useRef, useState } from "react";
import { streamCortex } from "@/services/api";
import { apiPath } from "@/config/env";
import { useAuth } from "@/contexts/AuthContext";
import { contextoCentral, ehSobreSituacao } from "./intencao";
import type { SituacaoCortex } from "./intencao";
import Logo from "./Logo";
import Composer from "./Composer";

// Pergunta direta ao Cortex: a resposta chega palavra por palavra (SSE do Worker em /api/cortex), sem abrir pedido.
// Para mudar código, "Virar pedido" manda a pergunta para a fila do Cortex como um pedido normal.
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
  const [falas, setFalas] = useState<Fala[]>([]);
  const [conversa] = useState(() => "cortex-app-" + Date.now().toString(36));
  const corte = useRef<AbortController | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const respondendo = falas.some((f) => f.vivo);

  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [falas]);
  useEffect(() => () => corte.current?.abort(), []);
  // Pergunta que chegou pelo "Pedir tarefa" (#823): responde na hora, sem abrir issue.
  const feita = useRef(false);
  useEffect(() => { if (primeira && !feita.current) { feita.current = true; void perguntar(primeira); } }, [primeira]); // eslint-disable-line react-hooks/exhaustive-deps

  const perguntar = async (texto: string, modo?: "rapido" | "pensar" | "pesquisar") => {
    const id = "c" + Date.now();
    // Exibe "pensando..." imediatamente (< 300 ms)
    setFalas((l) => [...l, { id: "d" + Date.now(), quem: "dono", texto }, { id, quem: "cortex", texto: "pensando...", vivo: true }]);
    const ctl = new AbortController();
    corte.current = ctl;
    const mudar = (f: (x: Fala) => Fala) => setFalas((l) => l.map((x) => (x.id === id ? f(x) : x)));
    try {
      const token = ehSobreSituacao(texto) ? await getToken().catch(() => null) : null;
      const ctx = ehSobreSituacao(texto) ? await lerCentral(token) : "";
      const message = ctx ? `${ctx}\n\nPergunta do dono: ${texto}` : texto;
      for await (const c of streamCortex({ message, tenantId: "nexia", conversationId: conversa, modo }, ctl.signal)) {
        if (typeof c.token === "string" && c.token) {
          const tok = c.token;
          mudar((x) => ({
            ...x,
            texto: x.texto === "pensando..." ? tok : x.texto + tok,
          }));
        }
        if (c.model) mudar((x) => ({ ...x, modelo: c.model }));
        if (c.done) break;
      }
    } catch (e) {
      if (!ctl.signal.aborted) {
        mudar((x) => ({
          ...x,
          texto: (x.texto === "pensando..." ? "" : x.texto) + `\n\n❌ ${(e as Error).message || "não consegui agora, tente de novo"}`,
        }));
      }
    } finally {
      mudar((x) => {
        const limpo = !x.texto || x.texto === "pensando...";
        const txtFinal = limpo
          ? (ctl.signal.aborted ? "(parado)" : "não consegui agora, tente de novo")
          : x.texto;
        return { ...x, vivo: false, texto: txtFinal };
      });
      corte.current = null;
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col" data-testid="cx-pergunta">
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
                <p className="whitespace-pre-wrap break-words text-[15px] leading-6" aria-live="polite" aria-busy={f.vivo ? "true" : "false"}>
                  {imagemDe(f.texto) ? <img src={imagemDe(f.texto)!} alt="Imagem criada pelo Cortex" className="rounded-2xl max-w-full w-[512px]" data-testid="cx-imagem" /> : f.texto}{f.vivo && <span className="inline-block w-2 h-4 align-middle ml-0.5 bg-[var(--cx-ac)] animate-pulse" />}
                </p>
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
