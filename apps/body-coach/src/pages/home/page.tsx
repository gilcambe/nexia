import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/feature/AuthContext';
import { useCoach } from '@/components/feature/CoachContext';
import { useReadiness } from '@/components/feature/ReadinessContext';
import DailyCheckIn from './components/DailyCheckIn';
import TodayCard from './components/TodayCard';
import NutritionCard from './components/NutritionCard';
import NuncaFalhe from './components/NuncaFalhe';

// Tela Hoje: só o essencial do dia (treino, dieta, água e o check-in). O resto fica em Ferramentas.
export default function Home() {
  const { setOpen } = useCoach();
  const { profile, user, loading } = useAuth();
  const { result } = useReadiness();
  const navigate = useNavigate();

  // Aluno que ainda não montou o plano: vai uma vez para o passo a passo de 1 minuto.
  useEffect(() => {
    if (loading || !user || !profile || profile.onboarding) return;
    const chave = `bc_ob_oferecido_${user.id}`;
    try {
      if (localStorage.getItem(chave)) return;
      localStorage.setItem(chave, '1');
    } catch { return; }
    navigate('/onboarding');
  }, [loading, user, profile, navigate]);

  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const firstName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Atleta';
  const hora = now.getHours();
  const saudacao = hora < 5 ? 'Boa noite' : hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium capitalize text-foreground-500">{dateStr}</p>
          <h1 className="mt-1 truncate font-heading text-2xl font-bold capitalize text-foreground-950">
            {saudacao}, {firstName}
          </h1>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary-500 px-3.5 py-1.5 text-xs font-semibold text-background-50 transition hover:bg-primary-600"
        >
          <i className="ri-robot-2-line"></i>
          Coach
        </button>
      </header>

      {profile && !profile.onboarding && (
        <Link to="/onboarding" className="flex items-center gap-3 rounded-2xl border border-primary-300 bg-primary-100 p-4">
          <i className="ri-magic-line text-2xl text-primary-600"></i>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground-950">Monte seu plano em 1 minuto</span>
            <span className="block text-xs text-foreground-600">Responda 4 perguntas e saia com treino e dieta prontos.</span>
          </span>
          <i className="ri-arrow-right-s-line text-xl text-primary-700"></i>
        </Link>
      )}

      <NuncaFalhe />
      <TodayCard />
      <NutritionCard />
      <DailyCheckIn />

      <Link to="/ferramentas" className="flex items-center gap-3 rounded-2xl border border-background-200 bg-background-50 p-4 transition hover:border-primary-300">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-xl text-primary-700"><i className="ri-apps-2-line"></i></span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-foreground-950">Ferramentas</span>
          <span className="block text-xs text-foreground-500">
            Resumo da semana{result ? ` (prontidão ${result.score})` : ''}, treinos prontos, corrida, conquistas e mais
          </span>
        </span>
        <i className="ri-arrow-right-s-line text-xl text-foreground-400"></i>
      </Link>
    </div>
  );
}
