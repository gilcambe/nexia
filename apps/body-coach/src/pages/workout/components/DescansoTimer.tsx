import { useEffect, useState } from 'react';

export interface DescansoTimerProps {
  segundos: number;
  onFinish?: () => void;
  onSkip?: () => void;
  onChange?: (segundos: number) => void;
}

export default function DescansoTimer({
  segundos: initialSegundos,
  onFinish,
  onSkip,
  onChange,
}: DescansoTimerProps) {
  const [segundos, setSegundos] = useState(initialSegundos);
  const [running, setRunning] = useState(true);
  const [totalSegundos, setTotalSegundos] = useState(initialSegundos);

  useEffect(() => {
    setSegundos(initialSegundos);
    setTotalSegundos(initialSegundos);
    setRunning(true);
  }, [initialSegundos]);

  useEffect(() => {
    if (!running || segundos <= 0) return;
    const id = setInterval(() => {
      setSegundos((s) => {
        const next = s - 1;
        if (next <= 0) {
          setRunning(false);
          navigator.vibrate?.([200, 100, 200]);
          onFinish?.();
          return 0;
        }
        onChange?.(next);
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, onFinish, onChange]);

  const progress = totalSegundos > 0 ? ((totalSegundos - segundos) / totalSegundos) * 100 : 0;

  const add = (delta: number) => {
    setSegundos((s) => Math.max(0, s + delta));
    setTotalSegundos((t) => Math.max(0, t + delta));
  };

  const handleSkip = () => {
    setRunning(false);
    setSegundos(0);
    onSkip?.();
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="rounded-2xl border border-background-200 bg-background-100/80 p-6 text-center">
      <p className="text-sm font-semibold text-foreground-500">Descanso</p>
      <p className="font-heading text-5xl font-bold text-foreground-950">{formatTime(segundos)}</p>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-background-200">
        <div
          className="h-full rounded-full bg-primary-500 transition-all duration-1000"
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          onClick={() => add(-15)}
          disabled={segundos <= 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-background-50 border border-background-200 px-3 py-1.5 text-xs font-semibold text-foreground-700 hover:bg-background-200 disabled:opacity-40 transition"
        >
          <i className="ri-subtract-line"></i>
          -15s
        </button>
        <button
          onClick={() => add(15)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-100 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-200 transition"
        >
          <i className="ri-add-line"></i>
          +15s
        </button>
        <button
          onClick={handleSkip}
          className="inline-flex items-center gap-1.5 rounded-lg bg-background-50 border border-background-200 px-3 py-1.5 text-xs font-semibold text-foreground-700 hover:bg-background-200 transition"
        >
          <i className="ri-skip-forward-line"></i>
          Pular
        </button>
      </div>
    </div>
  );
}
