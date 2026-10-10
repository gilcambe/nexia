import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { Fotos, Pose } from '@/lib/avaliacao/dados';

// Você de verdade, girando: as 4 fotos (frente, lado esquerdo, costas, lado direito) viram um giro
// de 360° ao arrastar o dedo. Usa as fotos reais do aluno, sem nenhum serviço pago.
const ORDEM: { id: Pose; label: string }[] = [
  { id: 'frente', label: 'Frente' },
  { id: 'esquerda', label: 'Lado esq.' },
  { id: 'costas', label: 'Costas' },
  { id: 'direita', label: 'Lado dir.' },
];
const PASSO_PX = 45;

export default function Fotos360({ fotos }: { fotos: Fotos }) {
  const poses = ORDEM.filter((p) => fotos[p.id]);
  const [i, setI] = useState(0);
  const [girar, setGirar] = useState(false);
  const arraste = useRef<{ x: number; i: number } | null>(null);

  useEffect(() => {
    if (!girar || poses.length < 2) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % poses.length), 1300);
    return () => window.clearInterval(t);
  }, [girar, poses.length]);

  if (!poses.length) return null;
  const atual = i % poses.length;

  const down = (e: RPointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    arraste.current = { x: e.clientX, i: atual };
    setGirar(false);
  };
  const move = (e: RPointerEvent) => {
    if (!arraste.current) return;
    const passos = Math.round((arraste.current.x - e.clientX) / PASSO_PX);
    setI((((arraste.current.i + passos) % poses.length) + poses.length) % poses.length);
  };
  const up = () => { arraste.current = null; };

  return (
    <div>
      <div
        className="relative h-[380px] w-full touch-pan-y select-none overflow-hidden rounded-2xl bg-[#efedea]"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        data-testid="fotos-360"
      >
        {poses.map((p, k) => (
          <img
            key={p.id}
            src={fotos[p.id]!}
            alt={`Você: ${p.label}`}
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full object-contain transition-opacity duration-300"
            style={{ opacity: k === atual ? 1 : 0 }}
          />
        ))}
        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap justify-center gap-1.5">
          {poses.map((p, k) => (
            <button key={p.id} type="button" onClick={() => { setGirar(false); setI(k); }} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur ${k === atual ? 'bg-foreground-900 text-background-50' : 'bg-background-50/80 text-foreground-700'}`}>{p.label}</button>
          ))}
          {poses.length > 1 && (
            <button type="button" onClick={() => setGirar((g) => !g)} className="rounded-full bg-background-50/80 px-2.5 py-1 text-[11px] font-semibold text-foreground-700 backdrop-blur" aria-label={girar ? 'Parar de girar' : 'Girar sozinho'}>
              <i className={girar ? 'ri-pause-line' : 'ri-refresh-line'}></i>
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-foreground-600">Arraste o dedo para girar. {poses.length < 4 ? 'Coloque as 4 poses na aba Fotos para o giro completo.' : ''}</p>
    </div>
  );
}
