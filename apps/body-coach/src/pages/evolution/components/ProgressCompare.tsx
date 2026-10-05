import { useMemo, useState } from 'react';
import type { ProgressEntry } from '@/hooks/useProgressData';

interface ComparePhoto {
  id: number;
  src: string;
  date: string;
  weight: number | null;
  bodyFat: number | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function ProgressCompare({ entries }: { entries: ProgressEntry[] }) {
  const photos: ComparePhoto[] = useMemo(
    () =>
      entries
        .filter((e) => e.signedUrl)
        .map((e) => ({
          id: e.id,
          src: e.signedUrl as string,
          date: formatDate(e.taken_at),
          weight: e.weight_kg,
          bodyFat: e.body_fat_pct,
        })),
    [entries],
  );

  const [leftIdx, setLeftIdx] = useState(0);
  const [rightIdx, setRightIdx] = useState(1);
  const [overlay, setOverlay] = useState(50);

  if (photos.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-background-300 py-12 text-center">
        <i className="ri-camera-line text-3xl text-foreground-400"></i>
        <p className="max-w-sm px-4 text-sm text-foreground-500">
          Envie ao menos <span className="font-semibold">duas fotos</span> de progresso (com datas
          diferentes) para comparar o antes e o depois.
        </p>
      </div>
    );
  }

  const left = photos[Math.min(leftIdx, photos.length - 1)];
  const right = photos[Math.min(rightIdx, photos.length - 1)];

  const diffWeight = (left.weight ?? 0) - (right.weight ?? 0);
  const diffFat = (left.bodyFat ?? 0) - (right.bodyFat ?? 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-foreground-500">Data A (mais recente)</label>
            <select
              value={leftIdx}
              onChange={(e) => setLeftIdx(Number(e.target.value))}
              className="rounded-lg border border-background-300 bg-background-50 px-3 py-1.5 text-sm text-foreground-800"
            >
              {photos.map((p, i) => (
                <option key={p.id} value={i}>
                  {p.date}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-foreground-500">Data B (mais antiga)</label>
            <select
              value={rightIdx}
              onChange={(e) => setRightIdx(Number(e.target.value))}
              className="rounded-lg border border-background-300 bg-background-50 px-3 py-1.5 text-sm text-foreground-800"
            >
              {photos.map((p, i) => (
                <option key={p.id} value={i}>
                  {p.date}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          {[
            { label: 'Peso', value: `${diffWeight >= 0 ? '+' : ''}${diffWeight.toFixed(1)} kg`, good: diffWeight < 0 },
            { label: 'Gordura', value: `${diffFat >= 0 ? '+' : ''}${diffFat.toFixed(1)}%`, good: diffFat < 0 },
          ].map((s) => (
            <div
              key={s.label}
              className={`rounded-xl px-3 py-2 text-center ${
                s.good ? 'bg-primary-100 text-primary-700' : 'bg-background-100 text-foreground-600'
              }`}
            >
              <p className="text-[10px] font-medium">{s.label}</p>
              <p className="text-sm font-bold">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="relative mx-auto aspect-[3/4] w-full max-w-[280px] overflow-hidden rounded-xl bg-background-100">
        <img
          src={left.src}
          alt={`Progresso ${left.date}`}
          className="absolute inset-0 h-full w-full select-none object-cover object-top"
          draggable={false}
        />
        <img
          src={right.src}
          alt={`Progresso ${right.date}`}
          className="absolute inset-0 h-full w-full select-none object-cover object-top"
          draggable={false}
          style={{ clipPath: `inset(0 0 0 ${overlay}%)` }}
        />
        <div className="pointer-events-none absolute inset-y-0" style={{ left: `${overlay}%` }}>
          <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-background-50"></div>
          <div className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-background-50 text-foreground-600">
            <i className="ri-arrow-left-right-line text-sm"></i>
          </div>
        </div>
        <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-background-50">
          {left.date}
        </span>
        <span className="absolute right-2 top-2 rounded-full bg-accent-500 px-2 py-0.5 text-[10px] font-semibold text-background-50 dark:text-foreground-950">
          {right.date}
        </span>
      </div>

      <div className="mx-auto mt-3 max-w-[280px]">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={overlay}
          onChange={(e) => setOverlay(Number(e.target.value))}
          className="w-full accent-primary-500"
        />
        <p className="mt-1 text-center text-[11px] text-foreground-400">Arraste o divisor para ver o antes/depois</p>
      </div>
    </div>
  );
}