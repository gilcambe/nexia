import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/components/feature/AuthContext';
import { diasSemTreinar } from '@/lib/ferramentas/conquistas';
import { carregarTreinos } from '@/lib/ferramentas/useHistorico';
import { dicaDoDia } from '@/lib/ferramentas/dicas';

// "Nunca falhe duas vezes": depois de 2 dias sem treino, um empurrão com treino curto.
// Sempre mostra o atalho para as ferramentas (conquistas, GPS, calculadoras...).
export default function NuncaFalhe() {
  const { user } = useAuth();
  const [dias, setDias] = useState<number | null>(null);
  const dica = dicaDoDia();
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
      <Link to="/ferramentas/dicas" className="flex items-start gap-3 rounded-2xl border border-background-200 bg-background-50 p-3">
        <i className="ri-lightbulb-flash-line text-xl text-primary-500"></i>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Dica do dia · {dica.cat}</span>
          <span className="block text-sm font-semibold text-foreground-900">{dica.titulo}</span>
          <span className="line-clamp-2 block text-xs text-foreground-600">{dica.texto}</span>
        </span>
      </Link>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {[
          { to: '/ferramentas/treinos-prontos', icone: 'ri-play-circle-line', nome: 'Treinos prontos' },
          { to: '/ferramentas/contador', icone: 'ri-camera-lens-line', nome: 'Contar reps' },
          { to: '/ferramentas/evolucao-carga', icone: 'ri-line-chart-line', nome: 'Cargas' },
          { to: '/ferramentas/corrida', icone: 'ri-run-line', nome: 'Corrida GPS' },
          { to: '/ferramentas/conquistas', icone: 'ri-trophy-line', nome: 'Conquistas' },
          { to: '/ferramentas/loja', icone: 'ri-store-2-line', nome: 'Loja' },
          { to: '/ferramentas', icone: 'ri-apps-2-line', nome: 'Todas' },
        ].map((a) => (
          <Link key={a.to} to={a.to} className="flex w-[80px] shrink-0 text-center leading-tight flex-col items-center gap-1 rounded-2xl border border-background-200 bg-background-50 py-2.5 text-[11px] font-semibold text-foreground-700">
            <i className={`${a.icone} text-xl text-primary-600`}></i>{a.nome}
          </Link>
        ))}
      </div>
    </div>
  );
}
