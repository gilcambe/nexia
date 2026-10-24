import { useEffect, useState } from 'react';
import { useAuth } from '@/components/feature/AuthContext';
import { carregarTreinos } from '@/lib/ferramentas/useHistorico';
import { calcularRecuperacao, GRUPOS_RECUPE, statusRecuperacao } from '@/lib/recuperacao';
import { Grupo } from '@/lib/exerciseDb';

export default function RecuperacaoCard() {
  const { user } = useAuth();
  const [recuperacao, setRecuperacao] = useState<Record<Grupo, number> | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let vivo = true;
    void carregarTreinos(user.id).then((treinos) => {
      if (vivo) {
        setRecuperacao(calcularRecuperacao(treinos));
      }
    });
    return () => {
      vivo = false;
    };
  }, [user?.id]);

  if (!recuperacao) return null;

  return (
    <div className="rounded-2xl border border-background-200 bg-background-50 p-3.5 shadow-sm" data-testid="recuperacao-muscular">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground-700">
          <i className="ri-heart-pulse-line text-primary-600 text-sm"></i>
          <span>Recuperação Muscular</span>
        </div>
        <span className="text-[11px] text-foreground-500">0–100%</span>
      </div>

      <div className="grid grid-cols-5 gap-y-1.5 gap-x-1 sm:grid-cols-10">
        {GRUPOS_RECUPE.map((g) => {
          const pct = recuperacao[g.id] ?? 100;
          const status = statusRecuperacao(pct);
          return (
            <div key={g.id} className="flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-medium text-foreground-600 truncate w-full px-0.5">
                {g.rotulo}
              </span>
              <div className="mt-0.5 flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${status.corBg} shrink-0`} title={`${g.rotulo}: ${pct}%`} />
                <span className="text-[10px] font-semibold text-foreground-800">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
