import { useState, type FormEvent } from 'react';

export interface NewSet {
  weight: number;
  reps: number;
  rir: number;
}

export default function SetEntry({
  minWeight,
  maxWeight,
  weightUnit,
  targetReps,
  onSubmit,
}: {
  minWeight: number;
  maxWeight: number;
  weightUnit: string;
  targetReps: string;
  onSubmit: (set: NewSet) => void;
}) {
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [rir, setRir] = useState('2');

  const canSubmit = weight !== '' && reps !== '';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ weight: Number(weight), reps: Number(reps), rir: Number(rir) });
    setWeight('');
    setReps('');
    setRir('2');
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-foreground-500">Carga ({weightUnit})</span>
        <input
          type="number"
          inputMode="decimal"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder={`${minWeight}–${maxWeight}`}
          className="rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-sm text-foreground-900 outline-none focus:border-primary-300"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-foreground-500">Reps ({targetReps})</span>
        <input
          type="number"
          inputMode="numeric"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          placeholder="12"
          className="rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-sm text-foreground-900 outline-none focus:border-primary-300"
        />
      </label>
      <label className="col-span-2 flex flex-col gap-1 sm:col-span-1">
        <span className="text-[11px] font-medium text-foreground-500">RIR</span>
        <input
          type="number"
          value={rir}
          onChange={(e) => setRir(e.target.value)}
          min={0}
          max={5}
          className="rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-sm text-foreground-900 outline-none focus:border-primary-300"
        />
      </label>
      <button
        type="submit"
        disabled={!canSubmit}
        className="col-span-2 mt-auto inline-flex h-[38px] items-center justify-center gap-1.5 rounded-lg bg-primary-500 px-4 text-sm font-semibold text-background-50 transition hover:bg-primary-600 disabled:opacity-40 sm:col-span-1"
      >
        <i className="ri-add-line"></i>
        Registrar
      </button>
    </form>
  );
}