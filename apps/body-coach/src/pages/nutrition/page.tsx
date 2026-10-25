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
import Favoritas from './components/Favoritas';
import AjudaRefeicao from './components/AjudaRefeicao';
import Abas, { useAba } from '@/components/base/Abas';

const ABAS = [
  { id: 'hoje', label: 'Hoje', icone: 'ri-restaurant-2-line' },
  { id: 'cardapio', label: 'Cardápio', icone: 'ri-book-open-line' },
  { id: 'ferramentas', label: 'Ideias', icone: 'ri-magic-line' },
] as const;

const FERRAMENTAS = [
  { id: 'rapida', label: 'Comi algo', icone: 'ri-restaurant-line' },
  { id: 'receita', label: 'Receita', icone: 'ri-bowl-line' },
  { id: 'ajuste', label: 'Ajuste', icone: 'ri-scales-3-line' },
  { id: 'tendencia', label: 'Semana', icone: 'ri-line-chart-line' },
] as const;

export default function Nutrition() {
  const { meals, water, waterGoal, targets, addMeal, removeMeal, addWater, resetWater, loading, error, reload } = useNutrition();
  const [showAdd, setShowAdd] = useState(false);
  const [aba, setAba] = useAba(ABAS.map((a) => a.id), 'hoje');
  const [ferramenta, setFerramenta] = useState<(typeof FERRAMENTAS)[number]['id']>('rapida');

  const mealCount = meals.length;

  return (
    <div className="flex flex-1 flex-col gap-2 alto:gap-2.5">
      <header className="flex items-center justify-between gap-2">
        <h1 className="font-heading text-xl font-bold text-foreground-950">Nutrição</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary-500 px-3 py-1.5 text-sm font-semibold text-background-50 transition hover:bg-primary-600"
        >
          <i className="ri-add-line text-base"></i>
          Registrar refeição
        </button>
      </header>

      <Abas abas={ABAS} atual={aba} onMudar={setAba} rotulo="Partes da nutrição" />

      {/* Hoje: o que comeu, quanto falta e a água. O resto fica nas outras abas, sem rolar. */}
      {aba === 'hoje' && (
        <>
          <Card padding="p-3">
            <MacroSummary meals={meals} targets={targets} />
          </Card>
          <Favoritas />
          <AjudaRefeicao />
          <Card padding="p-3" className="flex flex-1 flex-col">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-sm font-semibold text-foreground-950"><i className="ri-restaurant-2-line mr-1 text-secondary-500"></i>Refeições de hoje</h2>
              <span className="text-xs text-foreground-400">{mealCount ? `${mealCount} registradas` : 'nenhuma ainda'}</span>
            </div>
            {error && !loading ? (
              <div className="rounded-lg bg-primary-100/70 p-3 text-center">
                <p className="text-sm text-foreground-700">{error}</p>
                <button
                  onClick={reload}
                  className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50 transition hover:bg-primary-600"
                >
                  <i className="ri-refresh-line"></i>
                  Tentar novamente
                </button>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center gap-2 p-3 text-sm text-foreground-500">
                <i className="ri-loader-4-line animate-spin"></i>
                Carregando...
              </div>
            ) : meals.length > 0 ? (
              <MealList meals={meals} onRemove={removeMeal} />
            ) : (
              <button type="button" onClick={() => setShowAdd(true)} className="my-1.5 hidden flex-1 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-background-200 px-3 py-2 text-center text-sm text-foreground-500 alto:flex" data-testid="refeicoes-vazio">
                <i className="ri-restaurant-2-line text-2xl text-secondary-500 alto:text-3xl"></i>
                Toque para registrar a primeira refeição.
              </button>
            )}
            <div className="mt-auto border-t border-background-200 pt-2">
              <WaterTracker consumed={water} goal={waterGoal} onAdd={addWater} onReset={resetWater} />
            </div>
          </Card>
        </>
      )}

      {aba === 'cardapio' && (
        <>
          <CardapioDoDia />
          <PlanoNutricionista />
          <LembretesRefeicoes />
        </>
      )}

      {/* Ideias: uma ferramenta por vez, escolhida numa grade de 4 (cabe sem rolar). */}
      {aba === 'ferramentas' && (
        <>
          <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Ferramentas de nutrição">
            {FERRAMENTAS.map((f) => (
              <button key={f.id} type="button" onClick={() => setFerramenta(f.id)} aria-pressed={ferramenta === f.id} className={`flex flex-col items-center gap-0.5 rounded-xl border px-1 py-1.5 text-[11px] font-medium leading-tight ${ferramenta === f.id ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-background-200 bg-background-50 text-foreground-600'}`}>
                <i className={`${f.icone} text-lg`}></i>{f.label}
              </button>
            ))}
          </div>
          {ferramenta === 'rapida' && <RefeicaoRapida />}
          {ferramenta === 'receita' && <ReceitaIA />}
          {ferramenta === 'ajuste' && <AjusteSemanal />}
          {ferramenta === 'tendencia' && (
            <Card padding="p-3">
              <div className="mb-2 flex items-center gap-2">
                <i className="ri-line-chart-line text-lg text-primary-500"></i>
                <h2 className="font-heading text-sm font-semibold text-foreground-950">Tendência semanal</h2>
              </div>
              <WeeklyTrend />
            </Card>
          )}
        </>
      )}

      {showAdd && <AddMealModal onClose={() => setShowAdd(false)} onAdd={addMeal} />}
    </div>
  );
}