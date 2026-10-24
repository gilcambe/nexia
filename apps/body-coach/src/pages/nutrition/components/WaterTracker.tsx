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

  // Compacto: uma linha com o total e a barra, outra com os botões (a aba Hoje cabe sem rolar).
  const botao = 'whitespace-nowrap rounded-lg border border-background-200 bg-background-50 px-2.5 py-1 text-xs font-medium text-foreground-700 transition hover:bg-background-100';
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-foreground-600"><i className="ri-drop-line mr-1 text-accent-600"></i>Água <b className="font-heading text-foreground-950">{consumed.toFixed(2)}</b><span className="text-foreground-400"> / {goal.toFixed(1)} L</span></p>
        <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[11px] font-semibold text-accent-700">
          {remaining > 0 ? `faltam ${remaining.toFixed(1)} L` : 'meta atingida'}
        </span>
      </div>

      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-background-200">
        <div className="h-full rounded-full bg-accent-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <button onClick={() => onAdd(0.25)} className={botao}>+250 ml</button>
        <button onClick={() => onAdd(0.5)} className={botao}>+500 ml</button>
        <button onClick={() => onAdd(0.1)} className={botao}>+100 ml</button>
        <button onClick={onReset} className="ml-auto whitespace-nowrap px-1 py-1 text-xs font-medium text-foreground-400 transition hover:text-foreground-600" aria-label="Zerar a água de hoje">
          <i className="ri-refresh-line mr-0.5"></i>Zerar
        </button>
      </div>
    </div>
  );
}
