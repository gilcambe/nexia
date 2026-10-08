import { useEffect, useState } from 'react';

interface DescansoTimerProps {
  segundos: number;
  onSkip?: () => void;
  onFinish?: () => void;
}

export default function DescansoTimer({ segundos: initialSegundos, onSkip, onFinish }: DescansoTimerProps) {
  const [segundos, setSegundos] = useState(initialSegundos);
  const [isRunning, setIsRunning] = useState(true);

  // Efeito do intervalo com limpeza
  useEffect(() => {
    if (!isRunning || segundos <= 0) return;
    const id = setInterval(() => {
      setSegundos((s) => {
        const next = s - 1;
        if (next <= 0) {
          // Vibra ao zerar
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
          }
          setIsRunning(false);
          onFinish?.();
        }
        return Math.max(0, next);
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning, segundos, onFinish]);

  // Reinicia quando o prop inicial muda (nova série)
  useEffect(() => {
    setSegundos(initialSegundos);
    setIsRunning(true);
  }, [initialSegundos]);

  const progress = initialSegundos > 0 ? ((initialSegundos - segundos) / initialSegundos) * 100 : 100;

  const addTime = (delta: number) => {
    setSegundos((s) => Math.max(0, s + delta));
  };

  const formatTime = (s: number) => `${s}s`;

  return (
    <div className="rounded-2xl border border-background-200 bg-background-100/80 p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-foreground-500">Descanso</p>
        <button
          onClick={() => {
            setIsRunning(false);
            onSkip?.();
          }}
          className="rounded-full bg-background-50 border border-background-200 px-3 py-1.5 text-xs font-medium text-foreground-600 hover:bg-background-200 transition"
        >
          Pular
        </button>
      </div>

      <p className="font-heading text-5xl font-bold text-foreground-950 tabular-nums">{formatTime(segundos)}</p>

      {/* Barra de progresso */}
      <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-background-200">
        <div
          className="h-full rounded-full bg-primary-500 transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      {/* Botões +15s / -15s */}
      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          onClick={() => addTime(-15)}
          disabled={segundos <= 15}
          className="inline-flex items-center gap-1.5 rounded-lg bg-background-50 border border-background-200 px-4 py-2 text-sm font-semibold text-foreground-700 hover:bg-background-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <i className="ri-subtract-line"></i>
          -15 s
        </button>
        <button
          onClick={() => addTime(15)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50 hover:bg-primary-600 transition"
        >
          +15 s
          <i className="ri-add-line"></i>
        </button>
      </div>
    </div>
  );
}
