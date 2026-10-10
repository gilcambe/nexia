import { useEffect, useMemo, useRef, useState } from 'react';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import { setUserDoc } from '@/lib/userData';
import { OBJETIVOS, montarPeriodizacao, objetivoDoPerfil, semanaAtual, type Objetivo } from '@/lib/ferramentas/periodizacao';

const hojeISO = () => new Date().toISOString().slice(0, 10);

export default function Periodizacao() {
  const { user, profile, refreshProfile } = useAuth();
  const salvo = profile?.periodizacao ?? null;
  const [objetivo, setObjetivo] = useState<Objetivo>(salvo?.objetivo ?? objetivoDoPerfil(profile?.onboarding?.goal));
  const [semanas, setSemanas] = useState(salvo?.semanas ?? 12);
  const [inicio, setInicio] = useState(salvo?.inicio ?? hojeISO());
  const plano = useMemo(() => montarPeriodizacao(salvo?.objetivo ?? objetivo, salvo?.semanas ?? semanas), [salvo, objetivo, semanas]);
  const atual = salvo ? semanaAtual(salvo.inicio) : 0;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollIntoView({ block: 'center' }); }, [atual]);

  const salvar = (p: { objetivo: Objetivo; semanas: number; inicio: string } | null) => {
    if (user) void setUserDoc(user.id, 'profile', 'main', { periodizacao: p }, true).then(refreshProfile).catch(() => {});
  };

  if (!salvo) {
    return (
      <Card>
        <p className="text-sm text-foreground-600">A periodização divide seu treino em fases: o corpo recebe um estímulo novo a cada bloco e descansa na semana de descarga. É assim que atletas evoluem sem estagnar.</p>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-foreground-400">Objetivo</p>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {OBJETIVOS.map((o) => (
            <button key={o.id} type="button" onClick={() => setObjetivo(o.id)} className={`rounded-xl p-3 text-left ${objetivo === o.id ? 'bg-primary-500 text-background-50 dark:text-foreground-950' : 'border border-background-200 bg-background-50 text-foreground-800'}`}>
              <span className="block font-semibold">{o.nome}</span>
              <span className="block text-[11px] opacity-80">{o.desc}</span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-foreground-400">Duração</p>
        <div className="mt-1.5 grid grid-cols-4 gap-2">
          {[4, 8, 12, 16].map((n) => (
            <button key={n} type="button" onClick={() => setSemanas(n)} className={`rounded-xl py-2.5 text-sm font-semibold ${semanas === n ? 'bg-primary-500 text-background-50 dark:text-foreground-950' : 'border border-background-200 text-foreground-700'}`}>{n} sem.</button>
          ))}
        </div>
        <label className="mt-4 flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-foreground-400">Começa em</span>
          <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm" />
        </label>
        <button type="button" onClick={() => salvar({ objetivo, semanas, inicio })} className="mt-4 w-full rounded-xl bg-primary-500 py-3.5 font-semibold text-background-50 dark:text-foreground-950">Montar minha periodização</button>
      </Card>
    );
  }

  const nome = OBJETIVOS.find((o) => o.id === salvo.objetivo)?.nome;
  const terminou = atual > plano.length;
  return (
    <div className="space-y-3">
      <Card className="bg-gradient-to-br from-primary-500 to-primary-700 text-background-50 dark:text-foreground-950">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{nome} · {plano.length} semanas</p>
        <p className="font-heading text-2xl font-bold">{terminou ? 'Ciclo concluído!' : atual < 1 ? 'Começa em breve' : `Semana ${atual}: ${plano[atual - 1].fase}`}</p>
        <div className="mt-3 flex gap-0.5" aria-hidden>
          {plano.map((s) => <span key={s.semana} className={`h-2 flex-1 rounded-full ${s.semana < atual ? 'bg-white' : s.semana === atual ? 'bg-white ring-2 ring-white/50' : s.deload ? 'bg-black/30' : 'bg-white/30'}`} />)}
        </div>
        {terminou && <p className="mt-2 text-sm">Faça uma avaliação e comece o próximo ciclo com cargas novas.</p>}
      </Card>
      <div className="space-y-2">
        {plano.map((s) => {
          const ativa = s.semana === atual;
          return (
            <div key={s.semana} ref={ativa ? ref : undefined} className={`rounded-2xl border p-3 ${ativa ? 'border-2 border-primary-500 bg-primary-50' : s.deload ? 'border-dashed border-background-300 bg-background-50' : 'border-background-200 bg-background-50'} ${s.semana < atual ? 'opacity-60' : ''}`}>
              <p className="flex items-center justify-between text-sm font-semibold text-foreground-950">
                <span>Semana {s.semana} · {s.fase}</span>
                {ativa && <span className="rounded-full bg-primary-500 px-2 py-0.5 text-[10px] font-bold uppercase text-background-50 dark:text-foreground-950">Agora</span>}
                {s.semana < atual && <i className="ri-check-line text-emerald-600"></i>}
              </p>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-center text-xs">
                <span className="rounded-lg bg-background-100/80 p-1.5"><b className="block text-foreground-900">{s.series}</b>séries</span>
                <span className="rounded-lg bg-background-100/80 p-1.5"><b className="block text-foreground-900">{s.reps}</b>reps</span>
                <span className="rounded-lg bg-background-100/80 p-1.5"><b className="block text-foreground-900">{s.descanso}</b>descanso</span>
              </div>
              <p className="mt-1.5 text-xs text-foreground-600"><b>Esforço:</b> {s.esforco} · <b>Cardio:</b> {s.cardio}</p>
              <p className="mt-0.5 text-xs text-foreground-600">{s.foco}</p>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-foreground-400">RIR = repetições que ainda sobrariam no fim da série (RIR 2 = parar faltando 2). Os exercícios continuam os da sua ficha; a periodização muda séries, repetições, carga e descanso.</p>
      <button type="button" onClick={() => { if (window.confirm('Recomeçar a periodização?')) salvar(null); }} className="w-full py-2 text-sm text-foreground-500">Recomeçar / mudar objetivo</button>
    </div>
  );
}
