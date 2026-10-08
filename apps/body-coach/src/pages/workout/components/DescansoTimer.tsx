import { useEffect, useRef, useState } from 'react';

export default function DescansoTimer({
  segundos,
  onFinish,
  onSkip,
}: {
  segundos: number;
  onFinish?: () => void;
  onSkip?: () => void;
}) {
  const [segundosState, setSegundosState] = useState(segundos);
  const [running, setRunning] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialRef = useRef(segundos);

  // Sincroniza state quando a prop 'segundos' muda externamente (reset externo)
  useEffect(() => {
    setSegundosState(segundos);
    initialRef.current = segundos;
  }, [segundos]);

  // Timer countdown
  useEffect(() => {
    if (!running || segundosState <= 0) return;
    intervalRef.current = setInterval(() => {
      setSegundosState((s) => {
        const next = s - 1;
        if (next <= 0) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setRunning(false);
          // Vibração ao zerar
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
          }
          onFinish?.();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, onFinish]);

  // Progresso em % (0 a 100) - usa initialRef.current sincronizado
  const progress = initialRef.current > 0 ? ((initialRef.current - segundosState) / initialRef.current) * 100 : 0;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const addTime = (delta: number) => {
    setSegundosState((s) => Math.max(0, s + delta));
    initialRef.current = Math.max(0, initialRef.current + delta);
  };

  const handleSkip = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    setSegundosState(0);
    onSkip?.();
  };

  return (
    <div
      className="rounded-2xl border border-background-200 bg-background-100/80 p-6 text-center"
      role="timer"
      aria-live="polite"
      aria-label="Temporizador de descanso"
      aria-describedby="timer-value timer-progress"
    >
      <p className="text-sm font-semibold text-foreground-500">Descanso</p>
      <p
        id="timer-value"
        className="font-heading text-5xl font-bold text-foreground-950"
        aria-atomic="true"
      >
        {formatTime(segundosState)}
      </p>

      {/* Barra de progresso */}
      <div
        id="timer-progress"
        className="mt-4 h-3 w-full overflow-hidden rounded-full bg-background-200"
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso do descanso"
      >
        <div
          className="h-full rounded-full bg-primary-500 transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      {/* Controles */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={() => addTime(-15)}
          disabled={segundosState <= 15}
          className="inline-flex items-center gap-1.5 rounded-lg bg-background-50 border border-background-200 px-3 py-1.5 text-sm font-medium text-foreground-700 hover:bg-background-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
          aria-label="Diminuir 15 segundos do descanso"
        >
          <i className="ri-subtract-line" aria-hidden="true"></i>
          -15s
        </button>
        <button
          onClick={() => addTime(15)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-background-50 border border-background-200 px-3 py-1.5 text-sm font-medium text-foreground-700 hover:bg-background-200 transition"
          aria-label="Adicionar 15 segundos ao descanso"
        >
          <i className="ri-add-line" aria-hidden="true"></i>
          +15s
        </button>
        <button
          onClick={handleSkip}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-1.5 text-sm font-semibold text-background-50 hover:bg-primary-600 transition"
          aria-label="Pular descanso"
        >
          <i className="ri-skip-forward-line" aria-hidden="true"></i>
          Pular
        </button>
      </div>
    </div>
  );
}
