import { useAuth } from '@/components/feature/AuthContext';
import { useCoach } from '@/components/feature/CoachContext';
import { useReadiness } from '@/components/feature/ReadinessContext';
import { statusMeta } from '@/lib/readinessEngine';
import DailyCheckIn from './components/DailyCheckIn';
import TodayCard from './components/TodayCard';
import ReadinessCard from './components/ReadinessCard';
import ContinuityCard from './components/ContinuityCard';
import NutritionCard from './components/NutritionCard';
import EvolutionMini from './components/EvolutionMini';
import WeeklyReport from './components/WeeklyReport';

export default function Home() {
  const { setOpen } = useCoach();
  const { profile, user } = useAuth();
  const { result } = useReadiness();

  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const firstName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Atleta';

  const statusLabel = result
    ? statusMeta[result.status].label
    : 'Sem check-in';

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium capitalize text-foreground-500">{dateStr}</p>
          <h1 className="mt-1 font-heading text-2xl font-bold capitalize text-foreground-950">
            Bom dia, {firstName}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-background-200 bg-background-100 px-3 py-1.5 text-xs font-medium text-foreground-700">
            <i className="ri-heart-pulse-line text-accent-600"></i>
            Readiness{' '}
            <span className="font-bold">{result ? result.score : '—'}</span>
          </span>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-primary-500 px-3.5 py-1.5 text-xs font-semibold text-background-50 transition hover:bg-primary-600"
          >
            <i className="ri-robot-2-line"></i>
            Coach
          </button>
        </div>
      </header>

      <TodayCard />

      <DailyCheckIn />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ReadinessCard />
        <ContinuityCard />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <NutritionCard />
        <EvolutionMini />
      </div>

      <WeeklyReport />

      <footer className="border-t border-background-200 pt-4 text-center text-xs text-foreground-400">
        NEXIA Body Coach AI · {statusLabel} hoje — acompanhamento contínuo, não um gerador de treinos.
      </footer>
    </div>
  );
}