import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Icone } from "./icones";

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

// Tela cheia por cima de tudo, com "voltar". O botão voltar do celular também fecha.
export function Folha({ titulo, fechar, acao, children }: { titulo: string; fechar: () => void; acao?: ReactNode; children: ReactNode }) {
  const fecharRef = useRef(fechar);
  fecharRef.current = fechar;
  const fechouPorVoltar = useRef(false);
  useEffect(() => {
    history.pushState({ folha: titulo }, "");
    const voltar = () => fecharRef.current();
    window.addEventListener("popstate", voltar);
    const rolagem = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("popstate", voltar);
      document.body.style.overflow = rolagem;
      if (!fechouPorVoltar.current) {
        history.back();
      }
    };
  }, [titulo]);
  return (
    <div className="fixed inset-0 z-50 bg-[#f5f7fb] flex flex-col" role="dialog" aria-modal="true" aria-label={titulo} data-testid="folha">
      <div className="flex items-center gap-1 h-14 px-2 bg-white border-b border-slate-200 shrink-0">
        <button onClick={() => { fechouPorVoltar.current = true; history.back(); }} className="p-2 text-indigo-600 cursor-pointer" aria-label="Voltar" data-testid="folha-voltar">
          <Icone nome="seta" className="w-5 h-5 rotate-180" />
        </button>
        <h2 className="flex-1 min-w-0 font-semibold text-slate-900 truncate">{titulo}</h2>
        {acao && <div className="shrink-0 pr-2">{acao}</div>}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <NaFolha.Provider value={true}><Compacto.Provider value={false}>{children}</Compacto.Provider></NaFolha.Provider>
      </div>
    </div>
  );
}

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

// Nova seção para exibir tarefas por conta
export function TarefasPorConta({ tarefas }: { tarefas: Record<string, TarefaGratis[]> }) {
  return (
    <div className="mt-4">
      <h3 className="text-lg font-semibold mb-2">Tarefas por Conta</h3>
      {Object.entries(tarefas).map(([conta, tarefasConta]) => (
        <div key={conta} className="mb-4">
          <h4 className="text-md font-medium mb-1">{conta}</h4>
          <ul>
            {tarefasConta.map((tarefa) => (
              <li key={tarefa.numero} className="text-sm text-slate-600">
                {tarefa.titulo}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
