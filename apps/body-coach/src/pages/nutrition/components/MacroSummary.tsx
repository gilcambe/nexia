import type { MealFood, NutritionTargets } from '@/mocks/nutrition';

function sum(meals: MealFood[], key: keyof Pick<MealFood, 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber'>) {
  return meals.reduce((acc, m) => acc + m[key], 0);
}

function Ring({ pct, label, value, unit }: { pct: number; label: string; value: string; unit: string }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="flex flex-col items-center">
      <div
        className="relative flex h-[72px] w-[72px] items-center alto:h-24 alto:w-24 justify-center rounded-full"
        style={{ background: `conic-gradient(oklch(var(--primary-500)) ${clamped}%, oklch(var(--background-200)) 0)` }}
      >
        <div className="flex h-14 w-14 flex-col items-center justify-center rounded-full bg-background-50 alto:h-[76px] alto:w-[76px]">
          <span className="font-heading text-lg font-bold alto:text-2xl leading-none text-foreground-950">{value}</span>
          <span className="text-xs text-foreground-400">{unit}</span>
        </div>
      </div>
      <p className="mt-1 text-xs font-medium text-foreground-600">{label}</p>
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
        <span className="text-xs font-medium text-foreground-600 alto:text-sm">{label}</span>
        <span className="text-xs text-foreground-500">
          {current.toLocaleString('pt-BR')} / {target.toLocaleString('pt-BR')} {unit}
          {over && <span className="ml-1 font-semibold text-primary-600">· acima</span>}
        </span>
      </div>
      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-background-200 alto:h-2">
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

  const remainingCal = targets.calories - calories;
  const remainingProtein = targets.protein - protein;

  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2">
      <Ring
        pct={(calories / targets.calories) * 100}
        label="Calorias"
        value={calories.toLocaleString('pt-BR')}
        unit="kcal"
      />

      <div className="space-y-1 alto:space-y-2">
        <MacroBar label="Proteína" current={protein} target={targets.protein} unit="g" color="bg-primary-500" />
        <MacroBar label="Carboidratos" current={carbs} target={targets.carbs} unit="g" color="bg-accent-500" />
        <MacroBar label="Gorduras" current={fat} target={targets.fat} unit="g" color="bg-secondary-500" />
        <p className="rounded-md bg-secondary-100/50 px-2 py-1 text-[11px] leading-snug text-foreground-700">
          {remainingCal > 0 ? (
            <>
              Faltam <strong className="font-semibold text-foreground-950">{remainingCal.toLocaleString('pt-BR')} kcal</strong>
              {remainingProtein > 0 && <> e <strong className="font-semibold text-foreground-950">{remainingProtein} g prot.</strong></>}
            </>
          ) : (
            <>Meta de calorias de hoje batida. Agora é só água e boas escolhas.</>
          )}
        </p>
      </div>

    </div>
  );
}