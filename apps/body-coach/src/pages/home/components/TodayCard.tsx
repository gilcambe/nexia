import { useNavigate } from 'react-router-dom';
import { useCoach } from '@/components/feature/CoachContext';
import Card from '@/components/base/Card';

export default function TodayCard() {
  const navigate = useNavigate();
  const { setOpen } = useCoach();

  return (
    <Card className="relative overflow-hidden" padding="p-6">
      <div className="absolute right-0 top-0 h-full w-1.5 bg-primary-500"></div>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary-600">
        <i className="ri-sun-line"></i>
        Hoje
      </div>
      <h1 className="mt-3 font-heading text-2xl font-bold leading-tight text-foreground-950 md:text-[28px]">
        Treino de hoje
      </h1>
      <p className="mt-2 text-sm text-foreground-600">Abra o treino do seu plano e registre as séries na academia.</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={() => navigate('/workout')}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-6 py-3 text-sm font-semibold text-background-50 transition hover:bg-primary-600 whitespace-nowrap"
        >
          <i className="ri-play-circle-line text-lg"></i>
          INICIAR TREINO
        </button>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-background-200 bg-background-50 px-6 py-3 text-sm font-medium text-foreground-700 transition hover:bg-background-100 whitespace-nowrap"
        >
          <i className="ri-mic-line text-lg"></i>
          Falar com o Coach
        </button>
      </div>
    </Card>
  );
}