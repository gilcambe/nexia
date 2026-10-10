import { useState } from 'react';
import { useNutrition } from '@/components/feature/NutritionContext';
import Card from '@/components/base/Card';
import MacroSummary from './components/MacroSummary';
import MealList from './components/MealList';
import WaterTracker from './components/WaterTracker';
import WeeklyTrend from './components/WeeklyTrend';
import AddMealModal from './components/AddMealModal';
import CardapioDoDia from './components/CardapioDoDia';
import PlanoNutricionista from './components/PlanoNutricionista';
import LembretesRefeicoes from './components/LembretesRefeicoes';
import AjusteSemanal from './components/AjusteSemanal';
import ReceitaIA from './components/ReceitaIA';
import { RefeicaoRapida } from './components/RefeicaoRapida';
import AjudaRefeicao from './components/AjudaRefeicao';

export default function Nutrition() {
  const { meals, water, waterGoal, targets, addMeal, removeMeal, addWater, resetWater, loading, error, reload } = useNutrition();
  const [showAdd, setShowAdd] = useState(false);

  const mealCount = meals.length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground-950">Nutrição</h1>
          <p className="mt-1 text-sm text-foreground-600">
            Acompanhe o que você come, quanto ainda pode comer e sua hidratação do dia.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition hover:bg-primary-600"
        >
          <i className="ri-add-line text-lg"></i>
          Registrar refeição
        </button>
      </header>

      {/* macro summary */}
      <Card padding="p-6">
        <MacroSummary meals={meals} targets={targets} />
      </Card>

      <AjudaRefeicao />
      <AjusteSemanal />
      <PlanoNutricionista />
      <CardapioDoDia />
      <LembretesRefeicoes />
      <RefeicaoRapida />
      <ReceitaIA />

      {/* weekly trend */}
      <Card padding="p-5">
        <div className="mb-3 flex items-center gap-2">
          <i className="ri-line-chart-line text-lg text-primary-500"></i>
          <h2 className="font-heading text-base font-semibold text-foreground-950">Tendência semanal</h2>
        </div>
        <WeeklyTrend />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        {/* meals */}
        <Card padding="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <i className="ri-restaurant-2-line text-lg text-secondary-500"></i>
              <h2 className="font-heading text-base font-semibold text-foreground-950">Refeições</h2>
            </div>
            <span className="text-xs text-foreground-400">{mealCount} registradas</span>
          </div>
          {error && !loading ? (
            <div className="rounded-lg bg-primary-100/70 p-4 sm:p-6 text-center">
              <p className="text-sm text-foreground-700">{error}</p>
              <button
                onClick={reload}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50 transition hover:bg-primary-600"
              >
                <i className="ri-refresh-line"></i>
                Tentar novamente
              </button>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 p-6 text-sm text-foreground-500">
              <i className="ri-loader-4-line animate-spin"></i>
              Carregando...
            </div>
          ) : meals.length > 0 ? (
            <MealList meals={meals} onRemove={removeMeal} />
          ) : (
            <p className="rounded-lg bg-background-100/70 p-4 sm:p-6 text-center text-sm text-foreground-500">
              Nenhuma refeição registrada ainda. Adicione a primeira!
            </p>
          )}
        </Card>

        {/* water */}
        <Card padding="p-5">
          <WaterTracker consumed={water} goal={waterGoal} onAdd={addWater} onReset={resetWater} />
        </Card>
      </div>

      {showAdd && <AddMealModal onClose={() => setShowAdd(false)} onAdd={addMeal} />}
    </div>
  );
}