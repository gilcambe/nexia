import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useNutrition } from '@/components/feature/NutritionContext';
import Card from '@/components/base/Card';

function Bar({ current, target }: { current: number; target: number }) {
  const pct = Math.min(100, Math.round((current / target) * 100));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-background-200">
      <div
        className="h-full rounded-full bg-primary-500 transition-all"
        style={{ width: `${pct}%` }}
      ></div>
    </div>
  );
}

export default function NutritionCard() {
  const { water, waterGoal, totals, targets, addWater } = useNutrition();
  const [showRemaining, setShowRemaining] = useState(false);

  const macroList = [
    { key: 'Calorias', current: totals.calories, target: targets.calories },
    { key: 'Proteína', current: totals.protein, target: targets.protein },
    { key: 'Carbo', current: totals.carbs, target: targets.carbs },
    { key: 'Gordura', current: totals.fat, target: targets.fat },
  ];

  const remainingCal = targets.calories - totals.calories;
  const remainingProtein = targets.protein - totals.protein;

  return (
    <Card padding="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <i className="ri-restaurant-line text-lg text-secondary-500"></i>
          <h2 className="font-heading text-base font-semibold text-foreground-950">Nutrição do dia</h2>
        </div>
        <Link to="/nutrition" className="text-xs font-semibold text-primary-700">Ver dieta ›</Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {macroList.map((m) => (
          <div key={m.key}>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-foreground-500">{m.key}</span>
              <span className="text-sm font-semibold text-foreground-900">
                {m.current.toLocaleString('pt-BR')}
                <span className="text-[11px] font-normal text-foreground-400">/{m.target.toLocaleString('pt-BR')}</span>
              </span>
            </div>
            <div className="mt-1.5">
              <Bar current={m.current} target={m.target} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl bg-background-100/70 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-foreground-700">
          <i className="ri-drop-line text-accent-600"></i>
          <span>Água</span>
        </div>
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground-900">
            {water.toFixed(1)} / {waterGoal.toFixed(1)} L
          </span>
          <button
            onClick={() => addWater(0.25)}
            className="rounded-full bg-accent-500 px-3 py-1.5 text-xs font-semibold text-background-50 active:scale-95"
            aria-label="Bebi um copo de água (250 ml)"
          >
            + copo
          </button>
        </span>
      </div>

      <button
        onClick={() => setShowRemaining((v) => !v)}
        className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-xl border border-background-200 bg-background-50 px-4 py-2.5 text-sm font-medium text-primary-700 transition hover:bg-primary-100"
      >
        <i className="ri-question-line"></i>
        Quanto ainda posso comer?
        <i className={`ri-arrow-down-s-line transition ${showRemaining ? 'rotate-180' : ''}`}></i>
      </button>

      {showRemaining && (
        <div className="mt-3 rounded-xl border border-secondary-200 bg-secondary-100/50 p-3 text-sm leading-relaxed text-foreground-700">
          {remainingCal > 0 ? (
            <>
              Com base no que você já registrou hoje, você ainda pode consumir{' '}
              <strong className="font-semibold text-foreground-950">~{remainingCal.toLocaleString('pt-BR')} kcal</strong>.
              {remainingProtein > 0 && (
                <> Priorize <strong className="font-semibold text-foreground-950">{remainingProtein} g de proteína</strong> nas próximas refeições.</>
              )}
            </>
          ) : (
            <>Você já atingiu (ou passou) sua meta calórica de hoje. Mantenha a hidratação e a qualidade nutricional nas próximas escolhas.</>
          )}
        </div>
      )}
    </Card>
  );
}