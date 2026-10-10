import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/components/feature/AuthContext';
import { diasSemTreinar } from '@/lib/ferramentas/conquistas';
import { carregarTreinos } from '@/lib/ferramentas/useHistorico';

// "Nunca falhe duas vezes": depois de 2 dias sem treino, um empurrão com treino curto.
// Sempre mostra o atalho para as ferramentas (conquistas, GPS, calculadoras...).
export default function NuncaFalhe() {
  const { user } = useAuth();
  const [dias, setDias] = useState<number | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    carregarTreinos(user.id).then((l) => setDias(diasSemTreinar(l.filter((t) => t.done_at).map((t) => new Date(t.done_at as string))))).catch(() => {});
  }, [user?.id]);

  return (
    <div className="space-y-3">
      {dias !== null && dias >= 2 && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <i className="ri-alarm-warning-line text-2xl text-amber-600"></i>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">{dias} dias sem treinar. Nunca falhe duas vezes!</p>
            <p className="text-xs text-amber-800">Até 15 minutos hoje já mantêm o hábito vivo.</p>
          </div>
          <Link to="/workout" className="shrink-0 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white">Treinar</Link>
        </div>
      )}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {[
          { to: '/ferramentas/conquistas', icone: 'ri-trophy-line', nome: 'Conquistas' },
          { to: '/ferramentas/corrida', icone: 'ri-run-line', nome: 'Corrida GPS' },
          { to: '/ferramentas/calculadoras', icone: 'ri-calculator-line', nome: 'Calculadoras' },
          { to: '/ferramentas/suplementos', icone: 'ri-capsule-line', nome: 'Suplementos' },
          { to: '/ferramentas/jejum', icone: 'ri-hourglass-line', nome: 'Jejum' },
          { to: '/ferramentas', icone: 'ri-apps-2-line', nome: 'Todas' },
        ].map((a) => (
          <Link key={a.to} to={a.to} className="flex w-[76px] shrink-0 flex-col items-center gap-1 rounded-2xl border border-background-200 bg-background-50 py-2.5 text-[11px] font-semibold text-foreground-700">
            <i className={`${a.icone} text-xl text-primary-600`}></i>{a.nome}
          </Link>
        ))}
      </div>
    </div>
  );
}
