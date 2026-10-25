import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/components/feature/AuthContext';
import { usePapel } from '@/lib/usePapel';
import { abrirTour, guiaDo } from '@/lib/guia';

// Guia do app para consultar quando quiser (o mesmo texto do tour, mais completo).
export default function Guia() {
  const { user } = useAuth();
  const papel = usePapel(!!user);
  const passos = guiaDo(papel);
  const [aberto, setAberto] = useState(0);
  const atual = passos[aberto] ?? passos[0];
  // Grade de ícones e o texto do item escolhido embaixo: o guia todo cabe numa tela do celular.
  return (
    <div className="tela tela-fim mx-auto max-w-2xl">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-xl font-bold text-foreground-950">Guia do app</h1>
          <p className="text-xs text-foreground-600">{papel === 'coach' ? 'Tudo o que você faz como coach.' : 'Tudo o que você pode fazer no app.'} Toque num item.</p>
        </div>
        <button onClick={abrirTour} className="shrink-0 rounded-xl bg-primary-500 px-3 py-2 text-sm font-semibold text-background-50"><i className="ri-route-line mr-1"></i>Rever o tour</button>
      </div>
      <div className="grid grid-cols-4 gap-1.5" role="tablist" aria-label="Partes do guia">
        {passos.map((p, i) => (
          <button key={p.titulo} type="button" role="tab" aria-selected={atual === p} onClick={() => setAberto(i)} className={`flex flex-col items-center gap-0.5 rounded-xl border px-1 py-1.5 text-center text-[11px] font-medium leading-tight ${atual === p ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-background-200 bg-background-50 text-foreground-700'}`}>
            <i className={`${p.icone} text-lg text-primary-500`}></i>
            <span className="line-clamp-2">{p.titulo}</span>
          </button>
        ))}
      </div>
      {atual && (
        // O item escolhido ocupa o resto da tela: ícone grande, texto maior e o botão para abrir a tela.
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-background-200 bg-background-50 p-4 text-center" role="tabpanel">
          <i className={`${atual.icone} hidden text-5xl text-primary-500 alto:block`} aria-hidden="true"></i>
          <p className="font-heading text-base font-semibold text-foreground-900 alto:text-lg"><i className={`${atual.icone} mr-1 text-primary-500 alto:hidden`}></i>{atual.titulo}</p>
          <p className="max-w-sm text-sm text-foreground-700 alto:text-base">{atual.texto}</p>
          {atual.rota && atual.rota !== '/guia' && <Link to={atual.rota} className="mt-1 inline-flex rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-background-50 alto:text-base dark:text-foreground-950">Abrir esta tela</Link>}
        </div>
      )}
    </div>
  );
}
