import { useCallback, useEffect, useRef, useState } from "react";
import { haQuanto } from "../central/api";
import { usePedidos, lerCache, guardarCache } from "../meu-cortex/api";
import type { Detalhe, Situacao } from "../meu-cortex/api";
import Logo from "./Logo";
import Composer from "./Composer";

const ESTADO: Record<Situacao, { nome: string; cor: string; vivo: boolean }> = {
  fila: { nome: "Na fila", cor: "#f5b942", vivo: true }, fazendo: { nome: "Fazendo agora", cor: "#00d4aa", vivo: true },
  dividido: { nome: "Dividido em partes", cor: "#7c6cf0", vivo: true }, travado: { nome: "Travado", cor: "#ef5350", vivo: false },
  feito: { nome: "Feito", cor: "#00d4aa", vivo: false }, fechado: { nome: "Cancelado", cor: "#9a9aa8", vivo: false },
};
const PR_ESTADO = { aberto: "Aberto", rascunho: "Rascunho", juntado: "Já está no app", fechado: "Fechado sem entrar" } as const;
const CI = { verde: "Testes passaram", vermelho: "Testes falharam", rodando: "Testes rodando" } as Record<string, string>;

// Um pedido como conversa: o que o dono pediu, o que o Cortex respondeu, o estado ao vivo e os PRs entregues.
// Esconde a assinatura técnica que o servidor coloca no fim ("Pedido pelo Cortex no celular por ...").
const limpo = (t: string) => t.replace(/\n*_(?:Pedido |Pelo |pelo )[^_\n]*Cortex no celular[^_\n]*_\s*$/i, "");

export default function Conversa({ n, voltar }: { n: number; voltar: () => void }) {
  const { abrir, agir } = usePedidos();
  const [d, setD] = useState<Detalhe | null>(() => lerCache<Detalhe>("p" + n));
  const [erro, setErro] = useState<string>();
  const [msg, setMsg] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);

  const carregar = useCallback(() => { abrir(n).then((x) => { setD(x); setErro(undefined); guardarCache("p" + n, x); }).catch((e: Error) => setErro(e.message)); }, [abrir, n]);
  useEffect(() => { setD(lerCache<Detalhe>("p" + n)); carregar(); }, [carregar, n]);
  useEffect(() => {
    if (!d || !ESTADO[d.situacao].vivo) return;
    const t = setInterval(carregar, 15000);
    return () => clearInterval(t);
  }, [d, carregar]);
  useEffect(() => { fim.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [d?.conversa.length]);

  const fazer = async (corpo: Record<string, unknown>) => {
    setMsg(null);
    try { setMsg((await agir(corpo)).mensagem); carregar(); } catch (e) { setMsg((e as Error).message); }
  };

  if (erro && !d) return <div className="p-6 text-red-400" role="alert">{erro}</div>;
  if (!d) return <div className="p-6 space-y-3">{[1, 2, 3].map((k) => <div key={k} className="h-16 rounded-2xl bg-[var(--cx-card)] animate-pulse" />)}</div>;
  const e = ESTADO[d.situacao];
  const bot = (q: string) => q === "github-actions[bot]" || q.endsWith("[bot]");

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-[var(--cx-line)] flex items-center gap-3">
        <button onClick={voltar} className="text-[var(--cx-mut)] w-9 h-9" aria-label="Voltar" data-testid="cx-voltar">←</button>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold truncate" data-testid="cx-titulo">{d.titulo}</h2>
          <p className="text-xs text-[var(--cx-mut)] flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${e.vivo ? "animate-pulse" : ""}`} style={{ background: e.cor }} />
            <span data-testid="cx-estado">{e.nome}</span> · #{d.numero}{d.tentativas > 1 ? ` · ${d.tentativas} tentativas` : ""} · {haQuanto(d.quando)}
          </p>
        </div>
        {d.situacao === "travado" && <button onClick={() => fazer({ acao: "tentar", n })} className="h-10 px-3 rounded-xl bg-[var(--cx-ac)] text-black text-sm font-semibold">Tentar de novo</button>}
        {d.situacao !== "feito" && d.situacao !== "fechado"
          ? <button onClick={() => confirm("Cancelar este pedido?") && fazer({ acao: "cancelar", n })} className="h-10 px-3 rounded-xl border border-[var(--cx-line)] text-sm">Cancelar</button>
          : <button onClick={() => fazer({ acao: "reabrir", n })} className="h-10 px-3 rounded-xl border border-[var(--cx-line)] text-sm">Reabrir</button>}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-5">
          {d.conversa.map((c, k) => bot(c.quem) ? (
            <div key={k} className="flex gap-3" data-testid="cx-fala">
              <Logo tamanho={32} />
              <div className="min-w-0"><p className="text-xs text-[var(--cx-mut)] mb-1">Cortex · {haQuanto(c.quando)}</p>
                <p className="whitespace-pre-wrap break-words text-[15px] leading-6">{limpo(c.texto)}</p></div>
            </div>
          ) : (
            <div key={k} className="flex justify-end" data-testid="cx-fala">
              <div className="max-w-[88%] rounded-3xl rounded-br-md px-4 py-3 bg-[var(--cx-user)]">
                <p className="whitespace-pre-wrap break-words text-[15px] leading-6">{limpo(c.texto)}</p>
                <p className="text-[11px] text-[var(--cx-mut)] mt-1 text-right">{haQuanto(c.quando)}</p>
              </div>
            </div>
          ))}
          {e.vivo && <div className="flex gap-3 items-center text-sm text-[var(--cx-mut)]"><Logo tamanho={32} /><span className="animate-pulse">{d.situacao === "fila" ? "Esperando a vez na fila…" : "O Cortex está trabalhando…"}</span></div>}

          {d.prs.length > 0 && (
            <div className="rounded-2xl border border-[var(--cx-line)] bg-[var(--cx-card)] p-4 space-y-3" data-testid="cx-prs">
              <p className="text-sm font-semibold">Entregas do Cortex</p>
              {d.prs.map((p) => (
                <div key={p.numero} className="rounded-xl border border-[var(--cx-line)] p-3 text-sm space-y-2" data-testid="cx-pr">
                  <a href={p.link} target="_blank" rel="noopener noreferrer" className="block break-words font-medium underline-offset-2 hover:underline">PR #{p.numero} · {PR_ESTADO[p.estado]}</a>
                  {p.ci && <p className="text-xs text-[var(--cx-mut)]">{p.ci === "verde" ? "🟢" : p.ci === "vermelho" ? "🔴" : "🟡"} {CI[p.ci] || "Sem testes"} · {haQuanto(p.quando)}</p>}
                  {p.estado === "aberto" && p.ramo.startsWith("nexia/") && !p.automerge && (
                    <button onClick={() => confirm("Aprovar este PR? Ele entra no app quando os testes passarem.") && fazer({ acao: "juntar", pr: p.numero })} className="h-10 px-3 rounded-xl border border-[var(--cx-line)]">Aprovar e juntar</button>
                  )}
                  {p.automerge && p.estado === "aberto" && <p className="text-xs text-[var(--cx-ac)]">Aprovado: entra sozinho quando os testes passarem.</p>}
                </div>
              ))}
            </div>
          )}
          {msg && <p className="text-sm text-[var(--cx-ac)]" role="status">{msg}</p>}
          <div ref={fim} />
        </div>
      </div>
      <Composer modo="nota" enviar={async (texto) => { await agir({ acao: "comentar", n, texto }); carregar(); }} />
    </div>
  );
}
