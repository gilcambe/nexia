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
interface Fala { id: string; quem: "dono" | "cortex"; texto: string; vivo?: boolean; modelo?: string }

// #823: "como estamos?" / "o que falta?" leem a Central (fila do Cortex) antes de responder. Sem acesso, responde sem esse contexto.
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
    setFalas((l) => [...l, { id: "d" + Date.now(), quem: "dono", texto }, { id, quem: "cortex", texto: "", vivo: true }]);
    const ctl = new AbortController();
    corte.current = ctl;
    const mudar = (f: (x: Fala) => Fala) => setFalas((l) => l.map((x) => (x.id === id ? f(x) : x)));
    try {
      const ctx = ehSobreSituacao(texto) ? await lerCentral(await getToken().catch(() => null)) : "";
      const message = ctx ? `${ctx}\n\nPergunta do dono: ${texto}` : texto;
      for await (const c of streamCortex({ message, tenantId: "nexia", conversationId: conversa, modo }, ctl.signal)) {
        if (c.token) mudar((x) => ({ ...x, texto: x.texto + c.token }));
        if (c.model) mudar((x) => ({ ...x, modelo: c.model }));
        if (c.done) break;
      }
    } catch (e) {
      if (!ctl.signal.aborted) mudar((x) => ({ ...x, texto: x.texto + `\n\n❌ ${(e as Error).message || "A resposta foi interrompida."}` }));
    } finally {
      mudar((x) => ({ ...x, vivo: false, texto: x.texto || (ctl.signal.aborted ? "(parado)" : "Sem resposta agora. Tente de novo.") }));
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
                  {f.texto}{f.vivo && <span className="inline-block w-2 h-4 align-middle ml-0.5 bg-[var(--cx-ac)] animate-pulse" />}
                </p>
                {f.vivo && <button onClick={() => corte.current?.abort()} className="mt-2 h-9 px-3 rounded-xl border border-[var(--cx-line)] text-xs" data-testid="cx-parar">Parar</button>}
                {!f.vivo && k > 0 && (
                  <button onClick={() => virarPedido(falas[k - 1].texto)} className="mt-2 h-9 px-3 rounded-xl border border-[var(--cx-line)] text-xs" data-testid="cx-virar-pedido">Virar pedido</button>
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
