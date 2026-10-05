import { useState, useMemo, type FormEvent } from 'react';
import { useReadiness } from '@/components/feature/ReadinessContext';
import { computeReadiness, statusMeta } from '@/lib/readinessEngine';
import Card from '@/components/base/Card';

function SliderRow({
  label,
  value,
  min,
  max,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-foreground-600">{label}</span>
        <span className="text-sm font-semibold text-foreground-900">
          {value}
          {suffix ? ` ${suffix}` : ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-background-200 accent-primary-500"
        style={{
          background: `linear-gradient(to right, oklch(var(--primary-500)) ${pct}%, oklch(var(--background-200)) ${pct}%)`,
        }}
      />
    </div>
  );
}

export default function DailyCheckIn() {
  const { checkIn, hasCheckedToday, streak, today } = useReadiness();

  const [sleepHours, setSleepHours] = useState(7.5);
  const [sleepQuality, setSleepQuality] = useState(4);
  const [soreness, setSoreness] = useState(3);
  const [fatigue, setFatigue] = useState(4);
  const [energy, setEnergy] = useState(7);
  const [stress, setStress] = useState(4);
  const [painLevel, setPainLevel] = useState(0);
  const [hrv, setHrv] = useState('');
  const [rhr, setRhr] = useState('');
  const [notes, setNotes] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<'ok' | 'err'>('ok');

  const preview = useMemo(
    () =>
      computeReadiness({
        sleepHours,
        sleepQuality,
        soreness,
        fatigue,
        energy,
        stress,
        painLevel,
        hrv: hrv ? Number(hrv) : null,
        rhr: rhr ? Number(rhr) : null,
      }),
    [sleepHours, sleepQuality, soreness, fatigue, energy, stress, painLevel, hrv, rhr],
  );

  const meta = statusMeta[preview.status];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const { error } = await checkIn(
      {
        sleepHours,
        sleepQuality,
        soreness,
        fatigue,
        energy,
        stress,
        painLevel,
        hrv: hrv ? Number(hrv) : null,
        rhr: rhr ? Number(rhr) : null,
      },
      notes.trim() || undefined,
    );
    setSubmitting(false);
    if (error) {
      setMessageKind('err');
      setMessage(error);
    } else {
      setMessageKind('ok');
      setMessage('Check-in registrado! Seu Readiness de hoje foi atualizado.');
    }
  };

  return (
    <Card padding="p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <i className="ri-edit-circle-line text-lg text-accent-600"></i>
          <h2 className="font-heading text-base font-semibold text-foreground-950">Check-in diário</h2>
          {streak > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-100 px-2.5 py-0.5 text-xs font-semibold text-accent-700">
              <i className="ri-fire-line"></i>
              {streak} {streak === 1 ? 'dia' : 'dias'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground-500">Readiness agora:</span>
          <span className={`inline-flex items-center gap-1.5 rounded-full bg-background-100 px-3 py-1 text-xs font-semibold ${meta.text}`}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }}></span>
            {preview.score} · {meta.label}
          </span>
        </div>
      </div>

      {hasCheckedToday && today && (
        <div className="mb-4 rounded-xl bg-accent-100/60 px-4 py-2.5 text-sm text-accent-800">
          Você já fez o check-in de hoje (Readiness {today.readiness_score}). Ajuste abaixo para atualizar.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm text-foreground-600">Horas de sono</span>
                <input
                  type="number"
                  step={0.5}
                  min={0}
                  max={14}
                  value={sleepHours}
                  onChange={(e) => setSleepHours(Number(e.target.value))}
                  className="rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-sm outline-none focus:border-primary-300"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm text-foreground-600">Qualidade do sono</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setSleepQuality(q)}
                      className={`flex h-9 flex-1 items-center justify-center rounded-lg text-sm font-semibold transition ${
                        sleepQuality >= q
                          ? 'bg-primary-500 text-background-50'
                          : 'bg-background-100 text-foreground-400 hover:bg-background-200'
                      }`}
                      aria-label={`Qualidade ${q}`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </label>
            </div>

            <SliderRow label="Fadiga" value={fatigue} min={1} max={10} onChange={setFatigue} suffix="/10" />
            <SliderRow label="Energia" value={energy} min={1} max={10} onChange={setEnergy} suffix="/10" />
            <SliderRow label="Dores musculares" value={soreness} min={1} max={10} onChange={setSoreness} suffix="/10" />
          </div>

          <div className="space-y-4">
            <SliderRow label="Estresse" value={stress} min={1} max={10} onChange={setStress} suffix="/10" />
            <SliderRow label="Dor / desconforto" value={painLevel} min={0} max={10} onChange={setPainLevel} suffix="/10" />

            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium text-foreground-500 hover:text-foreground-700"
            >
              <i className={`ri-arrow-down-s-line transition ${showAdvanced ? 'rotate-180' : ''}`}></i>
              Métricas avançadas (wearable)
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm text-foreground-600">HRV (ms)</span>
                  <input
                    type="number"
                    value={hrv}
                    onChange={(e) => setHrv(e.target.value)}
                    placeholder="ex.: 54"
                    className="rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-sm outline-none focus:border-primary-300"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm text-foreground-600">FC repouso (bpm)</span>
                  <input
                    type="number"
                    value={rhr}
                    onChange={(e) => setRhr(e.target.value)}
                    placeholder="ex.: 61"
                    className="rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-sm outline-none focus:border-primary-300"
                  />
                </label>
              </div>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-foreground-600">Observações (opcional)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Como está se sentindo?"
                className="resize-none rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-sm outline-none focus:border-primary-300"
              />
            </label>
          </div>
        </div>

        {message && (
          <div
            className={`mt-4 rounded-lg px-3 py-2.5 text-sm ${
              messageKind === 'ok' ? 'bg-accent-100/70 text-accent-800' : 'bg-primary-100/70 text-primary-800'
            }`}
          >
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-4 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary-500 px-6 py-3 text-sm font-semibold text-background-50 transition hover:bg-primary-600 disabled:opacity-60"
        >
          {submitting && <i className="ri-loader-4-line animate-spin"></i>}
          {hasCheckedToday ? 'Atualizar check-in' : 'Registrar check-in'}
        </button>
      </form>
    </Card>
  );
}