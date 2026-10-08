import { useEffect, useState } from 'react';

interface DescansoTimerProps {
  segundos: number;
  onFinish: () => void;
  onSkip: () => void;
}

export default function DescansoTimer({ segundos: initialSegundos, onFinish, onSkip }: DescansoTimerProps) {
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
          if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
          }
          onFinish();
          return 0;
        }
        setProgress((next / initialSegundos) * 100);
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [segundos, initialSegundos, onFinish]);

  const addTime = (delta: number) => {
    setSegundos((s) => {
      const next = Math.max(0, s + delta);
      setProgress((next / initialSegundos) * 100);
      return next;
    });
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
      <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-background-200">
        <div
          className="h-full rounded-full bg-primary-500 transition-all duration-1000"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          onClick={() => addTime(-15)}
          disabled={segundos <= 15}
          className="inline-flex items-center gap-1.5 rounded-lg bg-background-50 border border-background-200 px-3 py-2 text-sm font-medium text-foreground-700 hover:bg-background-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <i className="ri-subtract-line"></i>
          -15s
        </button>
        <button
          onClick={onSkip}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50 hover:bg-primary-600 transition"
        >
          <i className="ri-skip-forward-line"></i>
          Pular
        </button>
        <button
          onClick={() => addTime(15)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-background-50 border border-background-200 px-3 py-2 text-sm font-medium text-foreground-700 hover:bg-background-200 transition"
        >
          <i className="ri-add-line"></i>
          +15s
        </button>
      </div>
    </div>
  );
}
