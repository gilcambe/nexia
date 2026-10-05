import type { MealFood, NutritionTargets } from '@/mocks/nutrition';

function sum(meals: MealFood[], key: keyof Pick<MealFood, 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber'>) {
  return meals.reduce((acc, m) => acc + m[key], 0);
}

function Ring({ pct, label, value, unit }: { pct: number; label: string; value: string; unit: string }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="flex flex-col items-center">
      <div
        className="relative flex h-32 w-32 items-center justify-center rounded-full"
        style={{ background: `conic-gradient(oklch(var(--primary-500)) ${clamped}%, oklch(var(--background-200)) 0)` }}
      >
        <div className="flex h-[104px] w-[104px] flex-col items-center justify-center rounded-full bg-background-50">
          <span className="font-heading text-2xl font-bold text-foreground-950">{value}</span>
          <span className="text-[11px] text-foreground-400">{unit}</span>
        </div>
      </div>
      <p className="mt-2 text-xs font-medium text-foreground-600">{label}</p>
    </div>
  );
}

function MacroBar({
  label,
  current,
  target,
  unit,
  color,
}: {
  label: string;
  current: number;
  target: number;
  unit: string;
  color: string;
}) {
  const pct = Math.min(100, Math.round((current / target) * 100));
  const over = current > target;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-foreground-600">{label}</span>
        <span className="text-xs text-foreground-500">
          {current.toLocaleString('pt-BR')} / {target.toLocaleString('pt-BR')} {unit}
          {over && <span className="ml-1 font-semibold text-primary-600">· acima</span>}
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-background-200">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function MacroSummary({ meals, targets }: { meals: MealFood[]; targets: NutritionTargets }) {
  const calories = sum(meals, 'calories');
  const protein = sum(meals, 'protein');
  const carbs = sum(meals, 'carbs');
  const fat = sum(meals, 'fat');
  const fiber = sum(meals, 'fiber');

  const remainingCal = targets.calories - calories;
  const remainingProtein = targets.protein - protein;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[auto_1fr] md:items-center">
      <Ring
        pct={(calories / targets.calories) * 100}
        label="Calorias"
        value={calories.toLocaleString('pt-BR')}
        unit="kcal"
      />

      <div className="space-y-4">
        <MacroBar label="Proteína" current={protein} target={targets.protein} unit="g" color="bg-primary-500" />
        <MacroBar label="Carboidratos" current={carbs} target={targets.carbs} unit="g" color="bg-accent-500" />
        <MacroBar label="Gorduras" current={fat} target={targets.fat} unit="g" color="bg-secondary-500" />
        <MacroBar label="Fibras" current={fiber} target={targets.fiber} unit="g" color="bg-foreground-400" />

        <div className="rounded-xl border border-secondary-200 bg-secondary-100/50 p-3 text-sm leading-relaxed text-foreground-700">
          {remainingCal > 0 ? (
            <>
              Ainda restam <strong className="font-semibold text-foreground-950">{remainingCal.toLocaleString('pt-BR')} kcal</strong>{' '}
              no seu plano de hoje.
              {remainingProtein > 0 && (
                <> Priorize mais <strong className="font-semibold text-foreground-950">{remainingProtein} g de proteína</strong> nas próximas refeições.</>
              )}
            </>
          ) : (
            <>Você já atingiu (ou passou) sua meta calórica de hoje. Mantenha a hidratação e a qualidade nas próximas escolhas.</>
          )}
        </div>
      </div>
    </div>
  );
}