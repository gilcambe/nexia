import { useState } from 'react';
import { markers, interpretMarker, type MarkerResult } from './markerRules';

const statusStyle: Record<MarkerResult['status'], string> = {
  normal: 'bg-secondary-100 text-secondary-900',
  low: 'bg-accent-100 text-accent-900',
  high: 'bg-primary-100 text-primary-800',
};

const statusLabel: Record<MarkerResult['status'], string> = {
  normal: 'Dentro do ideal',
  low: 'Abaixo',
  high: 'Acima',
};

export default function BloodMarkers() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [results, setResults] = useState<MarkerResult[]>([]);

  const handleInterpret = () => {
    const parsed: MarkerResult[] = [];
    markers.forEach((m) => {
      const raw = values[m.key];
      if (raw === undefined || raw.trim() === '') return;
      const n = parseFloat(raw.replace(',', '.'));
      if (!Number.isFinite(n)) return;
      const res = interpretMarker(m.key, n);
      if (res) parsed.push(res);
    });
    setResults(parsed);
  };

  return (
    <div>
      <p className="text-sm text-foreground-600">
        Cole os valores do seu último exame de sangue. O app interpreta cada marcador e sugere
        vitaminas, suplementos e encaminhamentos.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {markers.map((m) => (
          <label key={m.key} className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-600">
              {m.label} <span className="text-foreground-400">({m.unit})</span>
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder={`ex.: ${m.low}–${m.high}`}
              value={values[m.key] ?? ''}
              onChange={(e) => setValues((prev) => ({ ...prev, [m.key]: e.target.value }))}
              className="rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-sm text-foreground-800 outline-none focus:border-primary-400"
            />
          </label>
        ))}
      </div>

      <button
        onClick={handleInterpret}
        className="mt-4 inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition hover:bg-primary-600 dark:text-foreground-950"
      >
        <i className="ri-stethoscope-line text-lg"></i>
        Interpretar marcadores
      </button>

      {results.length > 0 && (
        <div className="mt-5 space-y-3">
          {results.map((r) => (
            <div key={r.label} className="rounded-xl border border-background-200 bg-background-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground-900">{r.label}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-foreground-500">
                    {r.value} {r.unit}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle[r.status]}`}>
                    {statusLabel[r.status]}
                  </span>
                </div>
              </div>
              <p className="mt-1.5 text-sm text-foreground-700">{r.message}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-foreground-500">
                <i className="ri-lightbulb-line mr-1 text-accent-600"></i>
                {r.suggestion}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}