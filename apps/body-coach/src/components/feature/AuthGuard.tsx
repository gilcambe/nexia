import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-50">
        <div className="flex flex-col items-center gap-3">
          <i className="ri-loader-4-line animate-spin text-3xl text-primary-500"></i>
          <p className="text-sm text-foreground-500">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Convite, loja de coach e link de indicação vão direto para o login; o resto conhece o app antes.
    const direto = /^\/(convite|loja)\//.test(location.pathname) || new URLSearchParams(location.search).has('ref');
    if (!direto) return <Navigate to={`/conheca${location.search}`} replace />;
    return <Navigate to={`/auth${location.search}`} replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}