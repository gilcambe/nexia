import { useEffect, useRef, useState } from 'react';

export interface DescansoTimerProps {
  segundos: number;
  onFinish: () => void;
  onSkip: () => void;
}

export default function DescansoTimer({ segundos: initialSegundos, onFinish, onSkip }: DescansoTimerProps) {
  const [segundos, setSegundos] = useState(initialSegundos);
  const [isRunning, setIsRunning] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialRef = useRef(initialSegundos);

  // Atualiza initialRef quando initialSegundos muda (para reset corretamente)
  useEffect(() => {
    initialRef.current = initialSegundos;
  }, [initialSegundos]);

  // Contagem regressiva com setInterval e limpeza
  useEffect(() => {
    if (!isRunning || segundos <= 0) return;

    intervalRef.current = setInterval(() => {
      setSegundos((s) => Math.max(0, s - 1));
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, segundos]);

  // Dispara onFinish quando segundos chegam a 0
  useEffect(() => {
    if (segundos <= 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      onFinish();
    }
  }, [segundos, onFinish]);

  const handleAdd15 = () => setSegundos((s) => s + 15);
  const handleSub15 = () => setSegundos((s) => Math.max(0, s - 15));
  const handleSkip = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    onSkip();
  };

  const progress = initialRef.current > 0 ? (initialRef.current - segundos) / initialRef.current : 0;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="rounded-2xl border border-background-200 bg-background-100/80 p-6 text-center" role="timer" aria-live="polite">
      <p className="text-sm font-semibold text-foreground-500">Descanso</p>
      <p className="font-heading text-5xl font-bold text-foreground-950 tabular-nums">{formatTime(segundos)}</p>

      {/* Barra de progresso */}
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-background-200">
        <div
          className="h-full rounded-full bg-primary-500 transition-all duration-1000 ease-linear"
          style={{ width: `${progress * 100}%` }}
        ></div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        <button
          onClick={handleSub15}
          disabled={segundos <= 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-background-50 border border-background-200 px-3 py-1.5 text-sm font-medium text-foreground-700 hover:bg-background-200 disabled:opacity-40 transition"
          aria-label="Remover 15 segundos"
        >
          <i className="ri-subtract-line"></i>
          -15s
        </button>
        <button
          onClick={handleSkip}
          className="inline-flex items-center gap-1.5 rounded-lg bg-background-50 border border-background-200 px-4 py-1.5 text-sm font-medium text-foreground-700 hover:bg-background-200 transition"
          aria-label="Pular descanso"
        >
          <i className="ri-skip-forward-line"></i>
          Pular
        </button>
        <button
          onClick={handleAdd15}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-1.5 text-sm font-medium text-background-50 hover:bg-primary-600 transition"
          aria-label="Adicionar 15 segundos"
        >
          <i className="ri-add-line"></i>
          +15s
        </button>
      </div>
    </div>
  );
}
