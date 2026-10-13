import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { usePapel } from '@/lib/usePapel';

// Separa as telas: as do coach só abrem para o coach; as do aluno mandam o coach para "Meus alunos".
export default function SoPapel({ papel, children }: { papel: 'coach' | 'aluno'; children: ReactNode }) {
  const { user } = useAuth();
  const atual = usePapel(!!user);
  if (atual === null) {
    return <div className="flex min-h-[40vh] items-center justify-center text-sm text-foreground-500"><i className="ri-loader-4-line mr-2 animate-spin text-xl text-primary-500"></i>Carregando...</div>;
  }
  if (papel === 'coach' && atual !== 'coach') return <Navigate to="/" replace />;
  if (papel === 'aluno' && atual === 'coach') return <Navigate to="/coach/alunos" replace />;
  return <>{children}</>;
}
