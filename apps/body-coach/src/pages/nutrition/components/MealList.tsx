import type { MealFood } from '@/mocks/nutrition';

export default function MealList({ meals, onRemove }: { meals: MealFood[]; onRemove: (id: string) => void }) {
  return (
    <div className="space-y-2">
      {meals.map((m) => (
        <div
          key={m.id}
          className="group flex items-center gap-4 rounded-xl border border-background-200 bg-background-50 px-4 py-3 transition hover:bg-background-100/60"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary-100 text-secondary-700">
            <i className="ri-restaurant-line text-lg"></i>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-medium text-foreground-900">{m.name}</p>
              <span className="shrink-0 text-xs text-foreground-400">{m.time}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-foreground-500">
              <span>{m.calories} kcal</span>
              <span className="text-primary-600">{m.protein} g proteína</span>
              <span>{m.carbs} g carbo</span>
              <span>{m.fat} g gordura</span>
            </div>
          </div>

          <button
            onClick={() => onRemove(m.id)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-foreground-400 opacity-0 transition hover:bg-background-200 hover:text-foreground-700 group-hover:opacity-100"
            aria-label="Remover refeição"
          >
            <i className="ri-delete-bin-line"></i>
          </button>
        </div>
      ))}
    </div>
  );
}