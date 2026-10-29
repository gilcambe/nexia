import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Icone } from "../pages/central/icones";
import { NaFolha, Compacto } from "../pages/central/celular";

// Tela cheia por cima de tudo, com "voltar".
// Detecta quando a tela é fechada SEM usar o botão voltar (popstate, tecla de voltar do celular,
// clique fora ou qualquer outro meio) e executa history.back() uma única vez.
// Não afeta outras telas: cada Folha gerencia seu próprio histórico e seu próprio estado.
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
      // Fecha sem usar o botão voltar: recua uma única vez no histórico.
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
        <NaFolha.Provider value={true}>
          <Compacto.Provider value={false}>
            {children}
          </Compacto.Provider>
        </NaFolha.Provider>
      </div>
    </div>
  );
}
