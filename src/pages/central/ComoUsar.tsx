import { useState, useEffect } from 'react';
import { Icone } from './icones';
import { useCelular } from './celular';

interface Passo {
  id: number;
  titulo: string;
  descricao: string;
}

interface Guia {
  titulo: string;
  passos: Passo[];
  dica: string;
  erroComum: string;
}

interface ComoUsarProps {
  guia: Guia;
}

export function ComoUsar({ guia }: ComoUsarProps) {
  const [aberto, setAberto] = useState(false);
  const celular = useCelular();

  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aberto]);

  return (
    <>
      {/* Botão de interrogação no canto do card */}
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-expanded={aberto}
        aria-label="Como usar"
        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors"
        data-testid="botao-comousar"
      >
        <Icone nome="interrogacao" className="w-4 h-4" />
      </button>

      {/* Painel lateral/modal responsivo */}
      {aberto && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-end md:items-center md:justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setAberto(false); }}
        >
                      <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="como-usar-titulo"
              className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
            >
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 id="como-usar-titulo" className="text-lg font-semibold text-slate-900">{guia.titulo}</h3>
              <button
                onClick={() => setAberto(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
                aria-label="Fechar"
              >
                <Icone nome="x" className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {/* Passos */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-slate-700 mb-3">Passos:</h4>
                <div className="space-y-3">
                  {guia.passos.map((passo) => (
                    <div key={passo.id} className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-medium">
                        {passo.id}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{passo.titulo}</p>
                        <p className="text-sm text-slate-600 mt-1">{passo.descricao}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Dica */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="text-sm font-medium text-blue-800 mb-2 flex items-center gap-1">
                  <Icone nome="lampada" className="w-4 h-4" />
                  Dica
                </h4>
                <p className="text-sm text-blue-700">{guia.dica}</p>
              </div>
              
              {/* Erro comum */}
              <div className="p-4 bg-amber-50 rounded-lg">
                <h4 className="text-sm font-medium text-amber-800 mb-2 flex items-center gap-1">
                  <Icone nome="atencao" className="w-4 h-4" />
                  Erro comum
                </h4>
                <p className="text-sm text-amber-700">{guia.erroComum}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}