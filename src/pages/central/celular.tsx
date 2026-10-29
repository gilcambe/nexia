import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Icone } from "./icones";
import { Folha } from "../celular/Folha";

// Central no celular: cada assunto vira um cartão compacto (uma linha) que abre a sua própria tela.
// No computador nada muda: os cartões aparecem abertos, como antes.

const CONSULTA = "(max-width: 1023px)";
export function useCelular() {
  const [celular, setCelular] = useState(() => typeof window !== "undefined" && window.matchMedia(CONSULTA).matches);
  useEffect(() => {
    const m = window.matchMedia(CONSULTA);
    const mudou = () => setCelular(m.matches);
    m.addEventListener("change", mudou);
    return () => m.removeEventListener("change", mudou);
  }, []);
  return celular;
}

// Compacto = a tela está no celular e os cartões viram linhas. NaFolha = o cartão já está aberto na tela dele (sem moldura nem título repetido).
export const Compacto = createContext(false);
export const NaFolha = createContext(false);

export type Tom = "ok" | "atencao" | "erro" | "cinza";
const TOM: Record<Tom, string> = { ok: "bg-emerald-500", atencao: "bg-amber-400", erro: "bg-red-500", cinza: "bg-slate-300" };

// Pedido para abrir um cartão assim que ele aparecer (ex.: botão "Conectar IAs" do Início abre a tela das vagas).
let pedido: string | null = null;
export function pedirAbrir(id: string) { pedido = id; }

// Linha de um cartão compacto: ícone, título, resumo de uma linha e sinal colorido. Toque abre a tela do assunto.
export function Abre({ id, titulo, resumo, icone, visual, tom, acao, solto = true, children }: {
  id?: string; titulo: string; resumo?: ReactNode; icone?: string; visual?: ReactNode; tom?: Tom; acao?: ReactNode; solto?: boolean; children: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  useEffect(() => { if (id && pedido === id) { pedido = null; setAberto(true); } }, [id]);
  const linha = (
    <button onClick={() => setAberto(true)} className="w-full flex items-center gap-3 px-4 py-3.5 bg-white text-left cursor-pointer active:bg-slate-50" data-testid={`abre-${id || titulo}`}>
      {visual || <span className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><Icone nome={icone || "lista"} className="w-5 h-5" /></span>}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-slate-900 truncate">{titulo}</span>
        {resumo && <span className="block text-xs text-slate-500 truncate mt-0.5">{resumo}</span>}
      </span>
      {tom && <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${TOM[tom]}`} />}
      <Icone nome="seta" className="w-4 h-4 text-slate-300 shrink-0" />
    </button>
  );
  return (
    <>
      {solto ? <div className="rounded-2xl border border-slate-200/80 overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.05)]">{linha}</div> : linha}
      {aberto && <Folha titulo={titulo} acao={acao} fechar={() => setAberto(false)}>{children}</Folha>}
    </>
  );
}

// Grupo de linhas num cartão só, com um título pequeno em cima (como os ajustes do celular).
export function Grupo({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <section>
      {titulo && <h2 className="px-1 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</h2>}
      <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden divide-y divide-slate-100 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
        <EmGrupo.Provider value={true}>{children}</EmGrupo.Provider>
      </div>
    </section>
  );
}
export const EmGrupo = createContext(false);

export function useModo() {
  return { compacto: useContext(Compacto), naFolha: useContext(NaFolha), emGrupo: useContext(EmGrupo) };
}
