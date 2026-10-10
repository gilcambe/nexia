import { useState } from 'react';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import { setUserDoc } from '@/lib/userData';
import { faseDoCiclo } from '@/lib/ferramentas/ciclo';

export default function Ciclo() {
  const { user, profile, refreshProfile } = useAuth();
  const ciclo = profile?.ciclo ?? null;
  const [inicio, setInicio] = useState(ciclo?.inicio ?? '');
  const [duracao, setDuracao] = useState(String(ciclo?.duracao ?? 28));
  const info = ciclo ? faseDoCiclo(ciclo.inicio, ciclo.duracao) : null;

  const salvar = (c: { inicio: string; duracao: number } | null) => {
    if (user) void setUserDoc(user.id, 'profile', 'main', { ciclo: c }, true).then(refreshProfile).catch(() => {});
  };

  return (
    <div className="space-y-3">
      {info && (
        <Card>
          <div className="flex items-center gap-3">
            <span className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full text-white ${info.cor}`}>
              <span className="text-[10px] leading-none">dia</span>
              <span className="font-heading text-xl font-bold leading-none">{info.dia}</span>
            </span>
            <div>
              <p className="font-heading text-lg font-bold text-foreground-950">Fase {info.nome}</p>
              <p className="text-xs text-foreground-500">Próxima menstruação prevista: {info.proxima.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}</p>
            </div>
          </div>
          <div className="mt-3 flex h-2.5 overflow-hidden rounded-full" aria-hidden>
            {Array.from({ length: info.duracao }, (_, i) => {
              const f = faseDoCiclo(ciclo!.inicio, info.duracao, new Date(new Date(ciclo!.inicio + 'T12:00:00').getTime() + i * 86400000));
              return <span key={i} className={`flex-1 ${f?.cor ?? ''} ${i + 1 === info.dia ? 'opacity-100 ring-2 ring-foreground-950' : 'opacity-50'}`} />;
            })}
          </div>
          <div className="mt-3 space-y-2">
            <p className="rounded-xl bg-background-100/70 p-3 text-sm text-foreground-800"><b><i className="ri-boxing-line mr-1"></i>Treino:</b> {info.treino}</p>
            <p className="rounded-xl bg-background-100/70 p-3 text-sm text-foreground-800"><b><i className="ri-restaurant-line mr-1"></i>Alimentação:</b> {info.nutricao}</p>
          </div>
        </Card>
      )}
      <Card>
        <h2 className="font-heading text-base font-semibold text-foreground-950">{ciclo ? 'Atualizar' : 'Ativar acompanhamento'}</h2>
        <p className="mt-1 text-xs text-foreground-500">Opcional. Fica só no seu perfil e serve para ajustar as dicas de treino e dieta.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-foreground-600">1º dia da última menstruação</span>
            <input type="date" value={inicio} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setInicio(e.target.value)} className="rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-foreground-600">Duração do ciclo</span>
            <input type="number" inputMode="numeric" min={21} max={45} value={duracao} onChange={(e) => setDuracao(e.target.value)} className="rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm" />
          </label>
        </div>
        <button type="button" disabled={!inicio} onClick={() => salvar({ inicio, duracao: Number(duracao) || 28 })} className="mt-3 w-full rounded-xl bg-primary-500 py-3 font-semibold text-background-50 disabled:opacity-50 dark:text-foreground-950">Salvar</button>
        {ciclo && <button type="button" onClick={() => { salvar(null); setInicio(''); }} className="mt-2 w-full rounded-xl py-2 text-sm text-foreground-500">Desativar e apagar</button>}
      </Card>
      <p className="text-[11px] text-foreground-400">Previsão por calendário, não é método contraceptivo nem diagnóstico. Ciclos irregulares ou dor forte: procure seu ginecologista.</p>
    </div>
  );
}
