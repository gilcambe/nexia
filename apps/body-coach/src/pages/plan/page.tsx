import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { buildWeekPlan, todayPlanDay, type Answers } from '@/lib/trainingPlan';
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
  const [onboarding, setOnboarding] = useState<Answers | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    getUserDoc<{ onboarding?: Answers }>(user.id, 'profile', 'main')
      .then((res) => setOnboarding(res?.onboarding ?? null))
      .catch(() => setOnboarding(null))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const planWeek = onboarding ? buildWeekPlan(onboarding) : [];
  const todayId = todayPlanDay(planWeek)?.id;
  const weekMinutes = planWeek.reduce((a, d) => a + d.duration, 0);

  if (loading) return <p className="text-sm text-foreground-500">Carregando...</p>;

  if (!onboarding) {
    return (
      <Card padding="p-5">
        <h1 className="font-heading text-xl font-bold text-foreground-950">Responda o questionário para montar seu plano</h1>
        <p className="mt-2 text-sm text-foreground-600">Com seus dias livres, nível e objetivo, o plano da semana é montado na hora.</p>
        <Link
          to="/onboarding"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-background-50 transition hover:bg-primary-600"
        >
          Responder agora <i className="ri-arrow-right-line"></i>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground-950">Plano de treino</h1>
          <p className="mt-1 text-sm text-foreground-600">
            {planWeek.length} sessões por semana · montado pelo seu questionário
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-100 px-3 py-1.5 text-xs font-semibold text-accent-700">
          <i className="ri-time-line"></i>
          {weekMinutes} min esta semana
        </span>
      </header>

      {/* week */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        {planWeek.map((day) => {
          const isDone = false;
          const isNext = day.id === todayId;
          return (
            <button
              key={day.id}
              onClick={() => isNext && navigate('/workout')}
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

    </div>
  );
}