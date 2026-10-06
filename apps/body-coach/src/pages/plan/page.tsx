import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildWeekPlan } from '@/lib/trainingPlan';
import { getUserDoc } from '@/lib/userData';
import { useAuth } from '@/components/feature/AuthContext';
import Card from '@/components/base/Card';

const intensityMeta = {
  media: { label: 'Média', cls: 'bg-secondary-100 text-secondary-700' },
  baixa: { label: 'Baixa', cls: 'bg-accent-100 text-accent-700' },
  alta: { label: 'Alta', cls: 'bg-primary-100 text-primary-700' },
} as const;

export default function Plan() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [onboarding, setOnboarding] = useState<any>(null);

  useEffect(() => {
    if (user?.id) {
      getUserDoc(user.id, 'profile', 'main').then((res) => {
        if (res && res.onboarding) {
          setOnboarding(res.onboarding);
        }
      });
    }
  }, [user?.id]);

  const plan = buildWeekPlan(onboarding);
  const { planWeek, phases, planNotes } = plan;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground-950">Plano de treino</h1>
          <p className="mt-1 text-sm text-foreground-600">
            {planWeek.length} sessões por semana · adaptativo à sua recuperação
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-100 px-3 py-1.5 text-xs font-semibold text-accent-700">
          <i className="ri-arrow-up-line"></i>
          236 min esta semana
        </span>
      </header>

      {/* phases */}
      <Card padding="p-5">
        <div className="mb-4 flex items-center gap-2">
          <i className="ri-route-line text-lg text-primary-500"></i>
          <h2 className="font-heading text-base font-semibold text-foreground-950">Fases do ciclo</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {phases.map((p) => (
            <div
              key={p.id}
              className={`rounded-xl border p-4 transition ${
                p.current ? 'border-primary-300 bg-primary-100/60' : 'border-background-200 bg-background-100/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-heading text-sm font-semibold text-foreground-900">{p.name}</p>
                {p.current && (
                  <span className="rounded-full bg-primary-500 px-2.5 py-0.5 text-[10px] font-semibold text-background-50">atual</span>
                )}
              </div>
              <p className="mt-1 text-xs text-foreground-400">{p.period}</p>
              <p className="mt-2 text-xs text-foreground-600">{p.objective}</p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-background-200">
                <div className={`h-full rounded-full ${p.current ? 'bg-primary-500' : 'bg-background-300'}`} style={{ width: `${p.distance}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* week */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        {planWeek.map((day) => {
          const isDone = done[day.id] ?? day.done ?? false;
          const isNext = day.next;
          return (
            <button
              key={day.id}
              onClick={() => !isNext && !isDone && navigate('/workout')}
              className={`relative flex flex-col rounded-2xl border p-4 text-left transition ${
                isDone
                  ? 'border-accent-200 bg-accent-100/50'
                  : isNext
                    ? 'border-primary-300 bg-primary-100/50'
                    : 'border-background-200 bg-background-50 hover:border-background-300'
              }`}
            >
              {isNext && (
                <span className="absolute right-3 top-3 rounded-full bg-primary-500 px-2 py-0.5 text-[10px] font-semibold text-background-50">
                  Hoje
                </span>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground-400">{day.day}</span>
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${intensityMeta[day.intensity].cls}`}>
                  {intensityMeta[day.intensity].label}
                </span>
              </div>
              <p className="mt-2 font-heading text-base font-semibold leading-snug text-foreground-950">{day.title}</p>
              <p className="mt-1 text-xs text-foreground-500">{day.focus}</p>
              <div className="mt-3 space-y-1">
                {day.exercises.slice(0, 3).map((e) => (
                  <p key={e.name} className="truncate text-[11px] text-foreground-500">
                    <i className="ri-heart-pulse-line mr-1 text-accent-600"></i>
                    {e.name} · {e.sets}
                  </p>
                ))}
              </div>
              <div className="mt-auto flex items-center gap-2 pt-3 text-xs">
                <i className="ri-time-line text-foreground-400"></i>
                <span className="text-foreground-500">{day.duration} min</span>
                {isDone && (
                  <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-accent-700">
                    <i className="ri-check-line"></i>concluído
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <Card padding="p-5">
        <div className="flex items-start gap-3">
          <i className="ri-robot-2-line mt-0.5 text-primary-600"></i>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Como o plano se adapta</p>
            <p className="mt-1 text-sm text-foreground-700">{planNotes}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}