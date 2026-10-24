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

  // Compacto: o total e os botões (em ml) numa linha, a barra embaixo (a aba Hoje cabe sem rolar).
  const botao = 'whitespace-nowrap rounded-lg border border-background-200 bg-background-50 px-2 py-1 text-xs font-medium text-foreground-700 transition hover:bg-background-100';
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <p className="mr-auto whitespace-nowrap text-sm text-foreground-600" title={remaining > 0 ? `faltam ${remaining.toFixed(1)} L` : 'meta atingida'}><i className="ri-drop-line mr-1 text-accent-600"></i><b className="font-heading text-foreground-950">{consumed.toFixed(2)}</b><span className="text-foreground-400">/{goal.toFixed(1)} L</span></p>
        <button onClick={() => onAdd(0.25)} className={botao} aria-label="Bebi 250 ml">+250</button>
        <button onClick={() => onAdd(0.5)} className={botao} aria-label="Bebi 500 ml">+500</button>
        <button onClick={() => onAdd(0.1)} className={botao} aria-label="Bebi 100 ml">+100</button>
        <button onClick={onReset} className="px-0.5 py-1 text-sm text-foreground-400 transition hover:text-foreground-600" aria-label="Zerar a água de hoje">
          <i className="ri-refresh-line"></i>
        </button>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-background-200" role="progressbar" aria-label="Água de hoje" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-accent-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
