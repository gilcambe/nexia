import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/components/feature/AuthContext';
import { diasSemTreinar } from '@/lib/ferramentas/conquistas';
import { carregarTreinos } from '@/lib/ferramentas/useHistorico';

// "Nunca falhe duas vezes": depois de 2 dias sem treino, um empurrão com treino curto.
// Só aparece quando precisa (a tela Hoje fica limpa).
export default function NuncaFalhe() {
  const { user } = useAuth();
  const [dias, setDias] = useState<number | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    carregarTreinos(user.id).then((l) => setDias(diasSemTreinar(l.filter((t) => t.done_at).map((t) => new Date(t.done_at as string))))).catch(() => {});
  }, [user?.id]);

  if (dias === null || dias < 2) return null;
  return (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <i className="ri-alarm-warning-line text-2xl text-amber-600"></i>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">{dias} dias sem treinar. Nunca falhe duas vezes!</p>
            <p className="text-xs text-amber-800">Até 15 minutos hoje já mantêm o hábito vivo.</p>
          </div>
          <Link to="/workout" className="shrink-0 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white">Treinar</Link>
        </div>
  );
}
