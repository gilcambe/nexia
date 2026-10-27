import { useEffect, useState } from "react";
import type { Aviso, Aba } from "./avisos";
import { useCentral } from "./api";
import { Icone } from "./icones";

// Janela de um alerta: o que aconteceu, o que afeta e o passo a passo. Sem um alerta escolhido, mostra a lista.
const COR = { vermelho: "bg-red-50 text-red-600", amarelo: "bg-amber-50 text-amber-600", verde: "bg-emerald-50 text-emerald-600", cinza: "bg-slate-100 text-slate-500" };
const BOTAO = "inline-flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-sm font-medium min-h-[40px] cursor-pointer disabled:opacity-50";

export default function AvisoDetalhe({ avisos, inicial, fechar, ir }: { avisos: Aviso[]; inicial: number | null; fechar: () => void; ir: (a: Aba) => void }) {
  const { agir } = useCentral();
  const [i, setI] = useState<number | null>(inicial);
  const [pedindo, setPedindo] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string; link?: string } | null>(null);
  useEffect(() => { const esc = (e: KeyboardEvent) => e.key === "Escape" && fechar(); window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc); }, [fechar]);
  const a = i === null ? null : avisos[i];

  const pedir = async (texto: string) => {
    setPedindo(true); setMsg(null);
    try { const r = await agir<{ ok: boolean; mensagem: string; link?: string }>({ acao: "pedir", texto }); setMsg({ ok: true, texto: r.mensagem, link: r.link }); }
    catch (e) { setMsg({ ok: false, texto: (e as Error).message }); }
    setPedindo(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4" onClick={fechar} role="dialog" aria-modal="true" data-testid="aviso-detalhe">
      <div className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-5 space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
          {a && avisos.length > 1 ? <button onClick={() => { setI(null); setMsg(null); }} className="text-sm text-indigo-600 font-medium cursor-pointer">‹ Todos os alertas</button>
            : <h2 className="font-semibold text-slate-900">{a ? "Alerta" : `Alertas (${avisos.length})`}</h2>}
          <button onClick={fechar} className="w-9 h-9 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer" aria-label="Fechar">✕</button>
        </div>

        {!a ? (
          !avisos.length ? <p className="text-sm text-slate-600">Tudo funcionando. Nada precisa de você.</p> : (
            <ul className="space-y-2">
              {avisos.map((x, k) => (
                <li key={k}>
                  <button onClick={() => setI(k)} className="w-full flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-left cursor-pointer hover:bg-slate-50" data-testid="aviso-item">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${COR[x.cor]}`}><Icone nome="alerta" className="w-4 h-4" /></span>
                    <span className="flex-1 text-sm text-slate-700">{x.texto}{x.sozinho && <span className="block text-xs text-emerald-700 mt-0.5">Resolve sozinho</span>}</span>
                    <span className="text-slate-300">›</span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${COR[a.cor]}`}><Icone nome="alerta" className="w-5 h-5" /></span>
              <h3 className="font-semibold text-slate-900 text-lg leading-snug">{a.texto}</h3>
            </div>
            <div className="space-y-2 text-sm">
              <p><b className="text-slate-900">O que aconteceu:</b> <span className="text-slate-700">{a.oque}</span></p>
              <p><b className="text-slate-900">O que isso afeta:</b> <span className="text-slate-700">{a.impacto}</span></p>
            </div>
            <div className={`rounded-xl p-3 ${a.sozinho ? "bg-emerald-50" : "bg-indigo-50"}`}>
              <div className="text-sm font-semibold text-slate-900 mb-1">{a.sozinho ? "✅ Resolve sozinho. Se quiser acompanhar:" : "O que fazer, passo a passo:"}</div>
              <ol className="list-decimal pl-5 space-y-1 text-sm text-slate-700" data-testid="aviso-passos">
                {a.passos.map((p) => <li key={p}>{p}</li>)}
              </ol>
            </div>
            <div className="flex flex-wrap gap-2">
              {a.link && <a className={`${BOTAO} border border-slate-200 bg-white text-slate-700`} href={a.link.url} target="_blank" rel="noopener noreferrer">{a.link.rotulo} ↗</a>}
              {a.conserto && <button className={`${BOTAO} bg-indigo-600 text-[#fff]`} onClick={() => pedir(a.conserto!)} disabled={pedindo} data-testid="aviso-consertar">{pedindo ? "Pedindo…" : "🛠️ Pedir conserto ao Cortex"}</button>}
              {a.aba !== "inicio" && <button className={`${BOTAO} border border-slate-200 bg-white text-slate-700`} onClick={() => { fechar(); ir(a.aba); }}>Abrir a aba</button>}
            </div>
            {msg && <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`} role="status">{msg.texto}{msg.link && <> <a className="text-indigo-600 font-medium" href={msg.link} target="_blank" rel="noopener noreferrer">Ver a tarefa ↗</a></>}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
