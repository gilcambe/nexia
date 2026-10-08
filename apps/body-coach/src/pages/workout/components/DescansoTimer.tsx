import { useEffect, useState, useRef, useCallback } from 'react';

interface DescansoTimerProps {
  segundos: number;
  onSkip: () => void;
  onChange?: (segundos: number) => void;
  onComplete?: () => void;
}

export default function DescansoTimer({ segundos: initialSegundos, onSkip, onChange, onComplete }: DescansoTimerProps) {
  const [segundos, setSegundos] = useState(initialSegundos);
  const [progress, setProgress] = useState(100);

  // Refs para o tempo atual e total, evitando recriar o intervalo
  const segundosRef = useRef(segundos);
  const totalRef = useRef(initialSegundos);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Atualiza refs quando estado muda
  useEffect(() => {
    segundosRef.current = segundos;
  }, [segundos]);

  useEffect(() => {
    totalRef.current = initialSegundos;
  }, [initialSegundos]);

  // Atualiza progresso baseado no total atual (ref)
  useEffect(() => {
    const total = totalRef.current;
    if (total > 0) {
      setProgress((segundos / total) * 100);
    }
  }, [segundos]);

  // Intervalo de contagem regressiva - observa initialSegundos para reiniciar quando muda externamente
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setSegundos(initialSegundos);
    setProgress(100);
    if (initialSegundos > 0) {
      const interval = setInterval(() => {
        setSegundos((s) => {
          const next = s - 1;
          if (next <= 0) {
            if (navigator.vibrate) {
              navigator.vibrate([200, 100, 200]);
            }
            onComplete?.();
          }
          return next;
        });
      }, 1000);
      intervalRef.current = interval;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [initialSegundos]);

  const addTime = useCallback((delta: number) => {
    setSegundos((s) => {
      const next = Math.max(0, s + delta);
      onChange?.(next);
      return next;
    });
  }, [onChange]);

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
          disabled={segundos <= 0}
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
