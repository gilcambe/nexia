import { useEffect, useState } from 'react';
import { useAuth } from '@/components/feature/AuthContext';
import { carregarTreinos } from '@/lib/ferramentas/useHistorico';
import { calcularRecuperacao, GRUPOS_RECUPE, statusRecuperacao } from '@/lib/recuperacao';
import { Grupo } from '@/lib/exerciseDb';

export default function RecuperacaoCard() {
  const { user } = useAuth();
  const [recuperacao, setRecuperacao] = useState<Record<Grupo, number> | null>(null);
  const [aberto, setAberto] = useState(false);

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

  // Uma linha: quem ainda está cansado (ou "tudo pronto"). O quadro completo abre no toque.
  const cansados = GRUPOS_RECUPE.map((g) => ({ g, pct: recuperacao[g.id] ?? 100 })).filter((x) => x.pct < 85).sort((a, b) => a.pct - b.pct);
  const resumo = cansados.length ? `Descansando: ${cansados.slice(0, 3).map((x) => `${x.g.rotulo} ${x.pct}%`).join(', ')}${cansados.length > 3 ? '…' : ''}` : 'Todos os músculos recuperados';

  return (
    <div className="rounded-2xl border border-background-200 bg-background-50 px-3 py-2 shadow-sm" data-testid="recuperacao-muscular">
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className="flex w-full items-center gap-1.5 text-left text-xs">
        <i className="ri-heart-pulse-line text-sm text-primary-600"></i>
        <span className="font-semibold uppercase tracking-wider text-foreground-700">Recuperação</span>
        <span className={`min-w-0 flex-1 truncate ${cansados.length ? 'text-secondary-800' : 'text-accent-700'}`}>· {resumo}</span>
        <i className={`text-foreground-400 ${aberto ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`}></i>
      </button>

      {aberto && (
      <div className="mt-2 grid grid-cols-5 gap-y-1.5 gap-x-1 sm:grid-cols-10">
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
      )}
    </div>
  );
}
