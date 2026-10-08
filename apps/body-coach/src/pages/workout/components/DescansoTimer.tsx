import { useEffect, useRef, useState } from 'react';

type TimerId = ReturnType<typeof setInterval>;

interface DescansoTimerProps {
  segundos: number;
  onFinish: () => void;
  onSkip: () => void;
}

export default function DescansoTimer({ segundos: initialSegundos, onFinish, onSkip }: DescansoTimerProps) {
  const [segundos, setSegundos] = useState(initialSegundos);
  const [isRunning, setIsRunning] = useState(true);
  const intervalRef = useRef<TimerId | null>(null);
  const initialRef = useRef(initialSegundos);
  const onFinishRef = useRef(onFinish);
  const onSkipRef = useRef(onSkip);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    onSkipRef.current = onSkip;
  }, [onSkip]);

  // Atualiza initialRef se o prop inicial mudar (ex: quando muda de exercício)
  useEffect(() => {
    initialRef.current = initialSegundos;
  }, [initialSegundos]);

  // Timer com setInterval e limpeza
  useEffect(() => {
    if (!isRunning || segundos <= 0) return;

    intervalRef.current = setInterval(() => {
      setSegundos((s) => {
        const next = s - 1;
        if (next <= 0) {
          // Vibra ao zerar
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
          }
          onFinishRef.current();
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const addTime = (delta: number) => {
    setSegundos((s) => Math.max(0, s + delta));
  };

  const handleSkip = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(false);
    onSkip();
  };

  const progress = initialRef.current > 0 ? (segundos / initialRef.current) * 100 : 0;

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="rounded-2xl border border-background-200 bg-background-100/80 p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-foreground-500">Descanso</p>
        <button
          onClick={() => setIsRunning(!isRunning)}
          className="text-xs text-foreground-500 hover:text-foreground-700"
          aria-label={isRunning ? 'Pausar' : 'Continuar'}
        >
          {isRunning ? <i className="ri-pause-line text-lg" /> : <i className="ri-play-line text-lg" />}
        </button>
      </div>

      <p className="font-heading text-5xl font-bold text-foreground-950 tabular-nums">{formatTime(segundos)}</p>

      {/* Barra de progresso */}
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-background-200">
        <div
          className="h-full rounded-full bg-primary-500 transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progresso do descanso"
        ></div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        <button
          onClick={() => addTime(-15)}
          disabled={segundos <= 15}
          className="inline-flex items-center gap-1.5 rounded-lg bg-background-50 border border-background-200 px-3 py-2 text-sm font-medium text-foreground-700 hover:bg-background-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
          aria-label="Remover 15 segundos"
        >
          <i className="ri-subtract-line text-lg" />
          <span>-15s</span>
        </button>
        <button
          onClick={handleSkip}
          className="inline-flex items-center gap-1.5 rounded-lg bg-background-50 border border-background-200 px-4 py-2 text-sm font-medium text-foreground-700 hover:bg-background-100 transition"
          aria-label="Pular descanso"
        >
          <i className="ri-skip-forward-line text-lg" />
          <span>Pular</span>
        </button>
        <button
          onClick={() => addTime(15)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-2 text-sm font-medium text-background-50 hover:bg-primary-600 transition"
          aria-label="Adicionar 15 segundos"
        >
          <i className="ri-add-line text-lg" />
          <span>+15s</span>
        </button>
      </div>
    </div>
  );
}
