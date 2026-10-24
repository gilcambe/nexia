import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useEffect, useState } from 'react';
import { recuperarApp, recuperouAgora } from '../../lib/recuperar';

export default function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <CarregandoComSaida />;
  }
  return <Liberado user={!!user} location={location}>{children}</Liberado>;
}

// Abrindo há mais de 10 s: mostra o botão "Abrir de novo"; aos 20 s, com internet, recupera sozinho (uma vez a cada 2 min).
// A cópia local do banco às vezes trava a abertura; apagar ela não tira o login nem os dados da nuvem.
function CarregandoComSaida() {
  const [demorou, setDemorou] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setDemorou(true), 10000);
    const t2 = setTimeout(() => { if (navigator.onLine && !recuperouAgora()) void recuperarApp({ dadosLocais: true }); }, 20000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
      <div className="flex min-h-screen items-center justify-center bg-background-50">
        <div className="flex flex-col items-center gap-3">
          <i className="ri-loader-4-line animate-spin text-3xl text-primary-500"></i>
          <p className="text-sm text-foreground-500">Carregando...</p>
          {demorou && (
            <button type="button" onClick={() => void recuperarApp({ dadosLocais: true })} className="mt-2 rounded-2xl bg-primary-500 px-5 py-3 text-sm font-bold text-white">
              Está demorando? Abrir de novo
            </button>
          )}
        </div>
      </div>
    );
}

function Liberado({ user, location, children }: { user: boolean; location: ReturnType<typeof useLocation>; children: ReactNode }) {
  if (!user) {
    // Convite, loja de coach e link de indicação vão direto para o login; o resto conhece o app antes.
    const direto = /^\/(convite|loja)\//.test(location.pathname) || new URLSearchParams(location.search).has('ref');
    if (!direto) return <Navigate to={`/conheca${location.search}`} replace />;
    return <Navigate to={`/auth${location.search}`} replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}