import ReadinessCard from '@/pages/home/components/ReadinessCard';
import ContinuityCard from '@/pages/home/components/ContinuityCard';
import StreakCard from '@/pages/home/components/StreakCard';
import EvolutionMini from '@/pages/home/components/EvolutionMini';
import WeeklyReport from '@/pages/home/components/WeeklyReport';

// Painéis que saíram da tela Hoje para ela ficar só com o essencial: sequência, prontidão,
// último treino, evolução e o relatório da semana.
export default function Resumo() {
  return (
    <div className="space-y-6">
      <StreakCard />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ReadinessCard />
        <ContinuityCard />
      </div>
      <EvolutionMini />
      <WeeklyReport />
    </div>
  );
}
