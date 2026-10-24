import { Link } from 'react-router-dom';
import { useNutrition } from '@/components/feature/NutritionContext';
import Card from '@/components/base/Card';

function Bar({ current, target }: { current: number; target: number }) {
  const pct = Math.min(100, Math.round((current / target) * 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-background-200">
      <div
        className="h-full rounded-full bg-primary-500 transition-all"
        style={{ width: `${pct}%` }}
      ></div>
    </div>
  );
}

export default function NutritionCard() {
  const { water, waterGoal, totals, targets, addWater } = useNutrition();

  const macroList = [
    { key: 'Calorias', current: totals.calories, target: targets.calories },
    { key: 'Proteína', current: totals.protein, target: targets.protein },
    { key: 'Carbo', current: totals.carbs, target: targets.carbs },
    { key: 'Gordura', current: totals.fat, target: targets.fat },
  ];

  const remainingCal = targets.calories - totals.calories;
  const remainingProtein = targets.protein - totals.protein;

  // Compacto: título com o que falta, 4 barras numa linha e a água. Cabe na tela Hoje sem rolar.
  return (
    <Card padding="p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h2 className="min-w-0 truncate font-heading text-sm font-semibold text-foreground-950">
          <i className="ri-restaurant-line mr-1 text-secondary-500"></i>Nutrição
          <span className="ml-1 text-xs font-normal text-foreground-500">· {remainingCal > 0 ? `faltam ${remainingCal.toLocaleString('pt-BR')} kcal${remainingProtein > 0 ? ` e ${remainingProtein} g de proteína` : ''}` : 'meta batida'}</span>
        </h2>
        <Link to="/nutrition" className="shrink-0 text-xs font-semibold text-primary-700">Ver dieta ›</Link>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {macroList.map((m) => (
          <div key={m.key} className="min-w-0">
            <p className="truncate text-[10px] text-foreground-500">{m.key}</p>
            <p className="truncate text-xs font-semibold text-foreground-900">
              {m.current.toLocaleString('pt-BR')}<span className="font-normal text-foreground-400">/{m.target.toLocaleString('pt-BR')}</span>
            </p>
            <div className="mt-0.5"><Bar current={m.current} target={m.target} /></div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between rounded-lg bg-background-100/70 px-3 py-1">
        <span className="flex items-center gap-1.5 text-sm text-foreground-700"><i className="ri-drop-line text-accent-600"></i>Água</span>
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground-900">{water.toFixed(1)} / {waterGoal.toFixed(1)} L</span>
          <button
            onClick={() => addWater(0.25)}
            className="rounded-full bg-accent-500 px-3 py-1 text-xs font-semibold text-background-50 active:scale-95"
            aria-label="Bebi um copo de água (250 ml)"
          >
            + copo
          </button>
        </span>
      </div>
    </Card>
  );
}