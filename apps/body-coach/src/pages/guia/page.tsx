import { Link } from 'react-router-dom';
import { useAuth } from '@/components/feature/AuthContext';
import { usePapel } from '@/lib/usePapel';
import { abrirTour, guiaDo } from '@/lib/guia';

// Guia do app para consultar quando quiser (o mesmo texto do tour, mais completo).
export default function Guia() {
  const { user } = useAuth();
  const papel = usePapel(!!user);
  const passos = guiaDo(papel);
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <h1 className="font-heading text-2xl font-bold text-foreground-950">Guia do app</h1>
      <p className="text-base text-foreground-600">{papel === 'coach' ? 'Tudo o que você faz como coach, passo a passo.' : 'Tudo o que você pode fazer no app, passo a passo.'}</p>
      <button onClick={abrirTour} className="w-full rounded-xl bg-primary-500 py-3 text-base font-semibold text-background-50"><i className="ri-route-line mr-1"></i>Rever o tour</button>
      {passos.map((p) => (
        <details key={p.titulo} className="rounded-2xl border border-background-200 bg-background-50 p-4">
          <summary className="flex cursor-pointer list-none items-center gap-3 text-base font-semibold text-foreground-900">
            <i className={`${p.icone} text-xl text-primary-500`}></i>{p.titulo}
          </summary>
          <p className="mt-2 text-base text-foreground-700">{p.texto}</p>
          {p.rota && p.rota !== '/guia' && <Link to={p.rota} className="mt-2 inline-block text-sm font-semibold text-primary-600 underline">Abrir esta tela</Link>}
        </details>
      ))}
    </div>
  );
}
