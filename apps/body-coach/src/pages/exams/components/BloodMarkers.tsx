import { useState } from 'react';
import { Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '@/components/feature/AuthContext';
import { setUserDoc } from '@/lib/userData';
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
  const { user, profile, refreshProfile } = useAuth();
  const hist = [...(profile?.marcadores_hist ?? [])].sort((a, b) => a.data.localeCompare(b.data));
  const [dataExame, setDataExame] = useState(new Date().toISOString().slice(0, 10));
  const [salvo, setSalvo] = useState(false);
  const [graf, setGraf] = useState<string | null>(null);

  // Guarda os valores com a data do exame: vira histórico com gráfico por marcador.
  const salvarHistorico = () => {
    if (!user) return;
    const valores: Record<string, number> = {};
    markers.forEach((m) => {
      const n = parseFloat((values[m.key] ?? '').replace(',', '.'));
      if (Number.isFinite(n)) valores[m.key] = n;
    });
    if (!Object.keys(valores).length) return;
    const novo = [...hist.filter((h) => h.data !== dataExame), { data: dataExame, valores }].sort((a, b) => a.data.localeCompare(b.data)).slice(-40);
    void setUserDoc(user.id, 'profile', 'main', { marcadores_hist: novo }, true).then(refreshProfile).catch(() => {});
    setSalvo(true);
  };
  const comHistorico = markers.filter((m) => hist.some((h) => h.valores[m.key] != null));

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
        <div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl bg-background-100/70 p-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-foreground-600">Data do exame</span>
            <input type="date" value={dataExame} onChange={(e) => { setDataExame(e.target.value); setSalvo(false); }} className="rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-sm" />
          </label>
          <button type="button" onClick={salvarHistorico} disabled={salvo} className="rounded-lg bg-foreground-900 px-4 py-2.5 text-sm font-semibold text-background-50 disabled:opacity-60">
            <i className={`${salvo ? 'ri-check-line' : 'ri-save-line'} mr-1`}></i>{salvo ? 'Salvo no histórico' : 'Salvar no histórico'}
          </button>
        </div>
      )}

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

      {comHistorico.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-400">Histórico ({hist.length} {hist.length === 1 ? 'exame' : 'exames'})</p>
          <div className="mt-2 space-y-2">
            {comHistorico.map((m) => {
              const pts = hist.filter((h) => h.valores[m.key] != null).map((h) => ({ data: h.data, v: h.valores[m.key] }));
              const ult = pts[pts.length - 1];
              const st = interpretMarker(m.key, ult.v)?.status ?? 'normal';
              const aberto = graf === m.key;
              return (
                <div key={m.key} className="rounded-xl border border-background-200 bg-background-50">
                  <button type="button" onClick={() => setGraf(aberto ? null : m.key)} className="flex w-full items-center justify-between gap-2 p-3 text-left">
                    <span className="text-sm font-semibold text-foreground-900">{m.label}</span>
                    <span className="flex items-center gap-2">
                      {pts.length > 1 && <span className="text-xs text-foreground-500">{pts[pts.length - 2].v} → </span>}
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle[st]}`}>{ult.v} {m.unit}</span>
                      <i className={`ri-arrow-${aberto ? 'up' : 'down'}-s-line text-foreground-400`}></i>
                    </span>
                  </button>
                  {aberto && (
                    <div className="h-40 px-1 pb-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={pts.map((p) => ({ dia: p.data.slice(5).split('-').reverse().join('/') + '/' + p.data.slice(2, 4), v: p.v }))} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
                          <ReferenceArea y1={m.low} y2={m.high} fill="oklch(var(--secondary-200))" fillOpacity={0.35} />
                          <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                          <Tooltip formatter={(v) => [`${v} ${m.unit}`, m.label]} />
                          <Line type="monotone" dataKey="v" stroke="oklch(var(--primary-500))" strokeWidth={2.5} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                      <p className="px-2 text-[11px] text-foreground-500">Faixa verde: ideal ({m.low}–{m.high} {m.unit}).</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
