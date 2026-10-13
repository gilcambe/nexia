import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { usePapel } from '@/lib/usePapel';

// Separa as telas: as do coach só abrem para o coach; as do aluno mandam o coach para "Meus alunos".
export function SoPapel({ papel, children }: { papel: 'coach' | 'aluno'; children: ReactNode }) {
  const { user, loading } = useAuth();
  const { papelAtual, loading: loadingPapel } = usePapel();

  if (loading || loadingPapel) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (papelAtual !== papel) {
    if (papel === 'coach') {
      return <Navigate to="/app/aluno" replace />;
    } else {
      return <Navigate to="/app/alunos" replace />;
    }
  }

  return <>{children}</>;
}
