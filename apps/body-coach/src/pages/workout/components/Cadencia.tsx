import { useEffect, useRef, useState } from 'react';
import { CADENCIAS, faseAgora } from '@/lib/cadencia';

let ctx: AudioContext | null = null;
function bip(freq: number) {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = ctx ?? new AC();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.13);
  } catch { /* sem áudio */ }
}

// Metrônomo da repetição: toque em Começar no início da série e siga o apito.
export default function Cadencia({ onFechar }: { onFechar: () => void }) {
  const [tipo, setTipo] = useState(() => { try { return localStorage.getItem('bc_cadencia') || '3-1-1'; } catch { return '3-1-1'; } });
  const [inicio, setInicio] = useState<number | null>(null);
  const [agora, setAgora] = useState(0);
  const ultima = useRef('');
  const c = CADENCIAS.find((x) => x.id === tipo) ?? CADENCIAS[0];
  const pos = inicio !== null ? faseAgora(c.fases, agora - inicio) : null;

  useEffect(() => {
    if (inicio === null) return;
    const t = setInterval(() => setAgora(Date.now()), 100);
    return () => clearInterval(t);
  }, [inicio]);
  useEffect(() => {
    if (!pos) return;
    const k = `${pos.rep}-${pos.fase}`;
    if (k !== ultima.current) { ultima.current = k; bip(c.fases[pos.fase].tom); }
  }, [pos, c]);

  const escolher = (id: string) => { setTipo(id); try { localStorage.setItem('bc_cadencia', id); } catch { /* ok */ } };
  return (
    <div className="mt-2 rounded-xl border border-secondary-300 bg-secondary-50 p-3" data-testid="cadencia">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground-900"><i className="ri-rhythm-line mr-1"></i>Cadência</p>
        <button type="button" onClick={onFechar} aria-label="Fechar cadência" className="text-foreground-500"><i className="ri-close-line"></i></button>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {CADENCIAS.map((x) => <button key={x.id} type="button" onClick={() => escolher(x.id)} aria-pressed={tipo === x.id} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${tipo === x.id ? 'border-secondary-500 bg-secondary-100 text-secondary-800' : 'border-background-300 text-foreground-600'}`}>{x.nome}</button>)}
      </div>
      {pos ? (
        <div className="mt-2 text-center" role="timer" aria-live="polite">
          <p className="font-heading text-3xl font-bold text-foreground-950">{c.fases[pos.fase].nome} <span className="tabular-nums">{pos.resta}</span></p>
          <p className="text-sm text-foreground-600">Repetição {pos.rep}</p>
          <button type="button" onClick={() => setInicio(null)} className="mt-2 rounded-xl border border-background-300 px-4 py-2 text-sm font-semibold">Parar</button>
        </div>
      ) : (
        <button type="button" onClick={() => { setInicio(Date.now()); setAgora(Date.now()); ultima.current = ''; }} className="mt-2 w-full rounded-xl bg-secondary-500 py-2.5 text-sm font-bold text-background-50" data-testid="comecar-cadencia">
          <i className="ri-play-line mr-1"></i>Começar a série
        </button>
      )}
    </div>
  );
}
