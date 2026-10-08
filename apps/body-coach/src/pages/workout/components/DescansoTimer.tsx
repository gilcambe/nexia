import { useEffect, useRef, useState } from 'react';

export interface DescansoTimerProps {
  segundos: number;
  onSkip?: () => void;
  onFinish?: () => void;
}

export default function DescansoTimer({ segundos: initialSegundos, onSkip, onFinish }: DescansoTimerProps) {
  const [segundos, setSegundos] = useState(initialSegundos);
  const [isRunning, setIsRunning] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialRef = useRef(initialSegundos);

  // Atualiza initialRef se o prop inicial mudar (novo descanso)
  useEffect(() => {
    initialRef.current = initialSegundos;
    setSegundos(initialSegundos);
    setIsRunning(true);
  }, [initialSegundos]);

  // Countdown com setInterval e limpeza
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
          setIsRunning(false);
          onFinish?.();
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, segundos]);

  const addTime = (delta: number) => {
    setSegundos((s) => Math.max(0, s + delta));
  };

  const handleSkip = () => {
    setIsRunning(false);
    onSkip?.();
  };

  const progress = initialRef.current > 0 ? (segundos / initialRef.current) * 100 : 0;
  const minutes = Math.floor(segundos / 60);
  const secs = segundos % 60;
  const timeString = `${minutes}:${secs.toString().padStart(2, '0')}`;

  return (
    <div className="rounded-2xl border border-background-200 bg-background-100/80 p-6">
      {/* Progress bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-background-200 mb-4">
        <div
          className="h-full rounded-full bg-primary-500 transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      {/* Timer display */}
      <p className="font-heading text-5xl font-bold text-foreground-950 font-mono tabular-nums">{timeString}</p>
      <p className="mt-1 text-sm text-foreground-500">Descanso</p>

      {/* Controls */}
      <div className="mt-4 flex items-center justify-center gap-2">
        <button
          onClick={() => addTime(-15)}
          disabled={segundos <= 15}
          className="inline-flex items-center gap-1.5 rounded-lg bg-background-50 border border-background-200 px-3 py-2 text-sm font-medium text-foreground-700 hover:bg-background-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
          aria-label="Diminuir 15 segundos"
        >
          <i className="ri-subtract-line"></i>
          -15s
        </button>
        <button
          onClick={handleSkip}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-100 px-4 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-200 transition"
        >
          <i className="ri-skip-forward-line"></i>
          Pular
        </button>
        <button
          onClick={() => addTime(15)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-background-50 border border-background-200 px-3 py-2 text-sm font-medium text-foreground-700 hover:bg-background-200 transition"
          aria-label="Adicionar 15 segundos"
        >
          +15s
          <i className="ri-add-line"></i>
        </button>
      </div>
    </div>
  );
}
