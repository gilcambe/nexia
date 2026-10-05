export default function WaterTracker({
  consumed,
  goal,
  onAdd,
  onReset,
}: {
  consumed: number;
  goal: number;
  onAdd: (liters: number) => void;
  onReset: () => void;
}) {
  const pct = Math.min(100, Math.round((consumed / goal) * 100));
  const remaining = Math.max(0, goal - consumed);

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm font-medium text-foreground-600">Hidratação</p>
          <p className="mt-1 font-heading text-3xl font-bold text-foreground-950">
            {consumed.toFixed(2)}
            <span className="ml-1 text-base font-medium text-foreground-400">/ {goal.toFixed(1)} L</span>
          </p>
        </div>
        <div className="text-right">
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-100 px-2.5 py-1 text-[11px] font-semibold text-accent-700">
            <i className="ri-drop-line"></i>
            {remaining > 0 ? `faltam ${remaining.toFixed(1)} L` : 'meta atingida'}
          </span>
        </div>
      </div>

      <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-background-200">
        <div className="h-full rounded-full bg-accent-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => onAdd(0.25)}
          className="whitespace-nowrap rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-sm font-medium text-foreground-700 transition hover:bg-background-100"
        >
          +250 ml
        </button>
        <button
          onClick={() => onAdd(0.5)}
          className="whitespace-nowrap rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-sm font-medium text-foreground-700 transition hover:bg-background-100"
        >
          +500 ml
        </button>
        <button
          onClick={() => onAdd(0.1)}
          className="whitespace-nowrap rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-sm font-medium text-foreground-700 transition hover:bg-background-100"
        >
          +100 ml
        </button>
        <button
          onClick={onReset}
          className="ml-auto whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-foreground-400 transition hover:text-foreground-600"
        >
          <i className="ri-refresh-line mr-1"></i>
          Zerar
        </button>
      </div>
    </div>
  );
}