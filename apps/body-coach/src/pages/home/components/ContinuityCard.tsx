import Card from '@/components/base/Card';

const last = [
  { set: 1, weight: 100, reps: 15 },
  { set: 2, weight: 120, reps: 12 },
  { set: 3, weight: 120, reps: 12 },
  { set: 4, weight: 140, reps: 10 },
];

const today = [
  { set: 1, weight: 100, reps: 15 },
  { set: 2, weight: 120, reps: 12 },
  { set: 3, weight: 120, reps: 12 },
  { set: 4, weight: 140, reps: 11 },
];

export default function ContinuityCard() {
  return (
    <Card padding="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <i className="ri-history-line text-lg text-primary-500"></i>
          <h2 className="font-heading text-base font-semibold text-foreground-950">Último treino</h2>
        </div>
        <span className="text-xs text-foreground-400">Leg Press · seg</span>
      </div>

      <div className="space-y-2">
        {last.map((l, i) => (
          <div key={l.set} className="flex items-center justify-between rounded-lg bg-background-100/70 px-3 py-2">
            <span className="flex items-center gap-2 text-sm text-foreground-500">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-background-200 text-[11px] font-semibold text-foreground-700">
                {i + 1}
              </span>
              Série
            </span>
            <span className="text-sm font-medium text-foreground-800">
              {l.weight} kg × {l.reps}
              <span
                className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  today[i].reps > l.reps ? 'bg-accent-100 text-accent-700' : 'bg-background-200 text-foreground-500'
                }`}
              >
                {today[i].reps > l.reps ? `+${today[i].reps - l.reps} rep` : 'igual'}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-accent-200 bg-accent-100/60 p-3 text-sm text-accent-800">
        <span className="font-semibold">Progressão:</span> +1 repetição na última série (140×10 → 140×11), RIR 1. Execução estável.
      </div>
    </Card>
  );
}