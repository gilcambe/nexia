import { useEffect, useRef, useState } from 'react';
import { falar, fraseDescanso, FRASE_FIM_DESCANSO } from '@/lib/ferramentas/vozCoach';
import { agendarFimDescanso, cancelarFimDescanso } from '@/lib/avisos';

export interface DescansoTimerProps {
  segundos: number;
  onFinish: () => void;
  onSkip: () => void;
  proximo?: string; // o que vem depois (aparece no aviso com a tela bloqueada)
}

// Bip curto e vibração: o aluno percebe o fim do descanso sem olhar para a tela.
function avisar() {
  try { navigator.vibrate?.([200, 100, 200]); } catch { /* sem vibração */ }
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.65);
    osc.onended = () => { void ctx.close(); };
  } catch { /* sem áudio */ }
}

export default function DescansoTimer({ segundos: initialSegundos, onFinish, onSkip, proximo }: DescansoTimerProps) {
  // Conta pelo relógio (hora em que acaba), não por "menos 1 a cada segundo": com a tela bloqueada o
  // celular congela a página, e ao voltar o tempo continua certo.
  const [fimEm, setFimEm] = useState(() => Date.now() + initialSegundos * 1000);
  const [agora, setAgora] = useState(() => Date.now());
  const initialRef = useRef(initialSegundos);
  const acabou = useRef(false);
  const segundos = Math.max(0, Math.ceil((fimEm - agora) / 1000));

  useEffect(() => {
    initialRef.current = initialSegundos;
    acabou.current = false;
    setFimEm(Date.now() + initialSegundos * 1000);
  }, [initialSegundos]);

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 250);
    const voltar = () => setAgora(Date.now());
    document.addEventListener('visibilitychange', voltar);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', voltar); };
  }, []);

  // Com a tela bloqueada ou em outro app, quem avisa é o service worker (se os avisos estiverem ligados).
  useEffect(() => {
    agendarFimDescanso(fimEm, proximo);
    return () => cancelarFimDescanso();
  }, [fimEm, proximo]);

  useEffect(() => {
    const f = fraseDescanso(segundos);
    if (f) falar(f);
  }, [segundos]);

  useEffect(() => {
    if (segundos <= 0 && !acabou.current) {
      acabou.current = true;
      if (document.visibilityState === 'visible') {
        avisar();
        falar(FRASE_FIM_DESCANSO);
      }
      onFinish();
    }
  }, [segundos, onFinish]);

  const handleAdd15 = () => { initialRef.current += 15; setFimEm((f) => Math.max(Date.now(), f) + 15000); };
  const handleSub15 = () => setFimEm((f) => f - 15000);
  const handleSkip = () => {
    acabou.current = true;
    cancelarFimDescanso();
    onSkip();
  };

  const progress = initialRef.current > 0 ? (initialRef.current - segundos) / initialRef.current : 0;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="rounded-2xl border border-background-200 bg-background-100/80 p-4 sm:p-6 text-center" role="timer" aria-live="polite">
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
