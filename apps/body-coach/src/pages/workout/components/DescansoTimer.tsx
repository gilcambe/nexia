import { useEffect, useState } from 'react';

interface DescansoTimerProps {
  segundos: number;
  onSkip: () => void;
  onChange?: (segundos: number) => void;
}

export default function DescansoTimer({ segundos: initialSegundos, onSkip, onChange }: DescansoTimerProps) {
  const [segundos, setSegundos] = useState(initialSegundos);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    setSegundos(initialSegundos);
    setProgress(100);
  }, [initialSegundos]);

  useEffect(() => {
    if (segundos <= 0) return;
    const interval = setInterval(() => {
      setSegundos((s) => {
        const next = s - 1;
        if (next <= 0) {
          if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
          }
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [segundos]);

  useEffect(() => {
    if (initialSegundos > 0) {
      setProgress((segundos / initialSegundos) * 100);
    }
  }, [segundos, initialSegundos]);

  const addTime = (delta: number) => {
    const next = Math.max(0, segundos + delta);
    setSegundos(next);
    onChange?.(next);
  };

  if (segundos <= 0) return null;

  const mins = Math.floor(segundos / 60);
  const secs = segundos % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

  return (
    <div className="rounded-2xl border border-background-200 bg-background-100/80 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground-500">Descanso</p>
        <p className="font-heading text-3xl font-bold text-foreground-950 tabular-nums">{timeStr}</p>
      </div>

      {/* progress bar */}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-background-200">
        <div
          className="h-full rounded-full bg-primary-500 transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      {/* controls */}
      <div className="mt-3 flex items-center justify-center gap-2">
        <button
          onClick={() => addTime(-15)}
          disabled={segundos <= 15}
          className="inline-flex items-center gap-1.5 rounded-lg bg-background-50 border border-background-200 px-3 py-1.5 text-xs font-semibold text-foreground-700 hover:bg-background-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
          aria-label="Remover 15 segundos"
        >
          <i className="ri-subtract-line"></i>
          -15s
        </button>
        <button
          onClick={onSkip}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-semibold text-background-50 hover:bg-primary-600 transition"
          aria-label="Pular descanso"
        >
          <i className="ri-skip-forward-line"></i>
          Pular
        </button>
        <button
          onClick={() => addTime(15)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-background-50 border border-background-200 px-3 py-1.5 text-xs font-semibold text-foreground-700 hover:bg-background-200 transition"
          aria-label="Adicionar 15 segundos"
        >
          <i className="ri-add-line"></i>
          +15s
        </button>
      </div>
    </div>
  );
}
