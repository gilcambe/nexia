import { useEffect, useState } from 'react';

export interface DescansoTimerProps {
  segundos: number;
  onSkip?: () => void;
  onFinish?: () => void;
}

export default function DescansoTimer({ segundos: initialSegundos, onSkip, onFinish }: DescansoTimerProps) {
  const [segundos, setSegundos] = useState(initialSegundos);
  const [isRunning, setIsRunning] = useState(true);

  // Atualiza o timer quando initialSegundos muda (novo descanso)
  useEffect(() => {
    setSegundos(initialSegundos);
    setIsRunning(true);
  }, [initialSegundos]);

  // Countdown com setInterval e limpeza
  useEffect(() => {
    if (!isRunning || segundos <= 0) return;

    const interval = setInterval(() => {
      setSegundos((s) => {
        if (s <= 1) {
          setIsRunning(false);
          // Vibra o aparelho ao zerar
          if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
          }
          onFinish?.();
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, segundos, onFinish]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = initialSegundos > 0 ? ((initialSegundos - segundos) / initialSegundos) * 100 : 0;

  return (
    <div className="rounded-2xl border border-background-200 bg-background-100/80 p-6 text-center">
      <p className="text-sm font-semibold text-foreground-500">Descanso</p>
      <p className="font-heading text-5xl font-bold text-foreground-950">{formatTime(segundos)}</p>
      
      {/* Barra de progresso */}
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-background-200">
        <div
          className="h-full rounded-full bg-primary-500 transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2">
        <button
          onClick={() => setSegundos((s) => Math.max(0, s - 15))}
          disabled={segundos <= 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-background-50 border border-background-200 px-3 py-2 text-sm font-medium text-foreground-700 hover:bg-background-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
          aria-label="Diminuir 15 segundos"
        >
          <i className="ri-subtract-line"></i>
          -15s
        </button>
        <button
          onClick={() => {
            setIsRunning(!isRunning);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50 hover:bg-primary-600 transition"
          aria-label={isRunning ? 'Pausar' : 'Continuar'}
        >
          <i className={isRunning ? 'ri-pause-line' : 'ri-play-line'}></i>
          {isRunning ? 'Pausar' : 'Continuar'}
        </button>
        <button
          onClick={() => setSegundos((s) => s + 15)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-background-50 border border-background-200 px-3 py-2 text-sm font-medium text-foreground-700 hover:bg-background-200 transition"
          aria-label="Adicionar 15 segundos"
        >
          <i className="ri-add-line"></i>
          +15s
        </button>
        <button
          onClick={() => {
            setIsRunning(false);
            onSkip?.();
          }}
          className="mt-2 sm:mt-0 inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-2 text-sm font-medium text-background-50 hover:bg-accent-600 transition"
          aria-label="Pular descanso"
        >
          <i className="ri-skip-forward-line"></i>
          Pular
        </button>
      </div>
    </div>
  );
}
