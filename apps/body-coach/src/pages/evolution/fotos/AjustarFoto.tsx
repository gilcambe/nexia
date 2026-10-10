import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { createPortal } from 'react-dom';

// Ajuste da foto antes de salvar: o aluno arrasta e aproxima/afasta (pinça ou barra) para
// enquadrar o corpo inteiro na moldura 3:4. A foto sai já recortada, então nada fica cortado depois.
const SAIDA_H = 1200;
const SAIDA_W = 900;
const FUNDO = '#efedea';

export default function AjustarFoto({ arquivo, titulo, onPronto, onCancelar }: {
  arquivo: Blob;
  titulo: string;
  onPronto: (b: Blob) => void;
  onCancelar: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // deslocamento em fração da moldura
  const moldura = useRef<HTMLDivElement>(null);
  const toques = useRef(new Map<number, { x: number; y: number }>());
  const inicio = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(arquivo);
    setSrc(u);
    const img = new Image();
    img.onload = () => setNat({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = u;
    return () => URL.revokeObjectURL(u);
  }, [arquivo]);

  // Tamanho da imagem na moldura (fração da largura/altura) com zoom 1 = a foto inteira cabe.
  const base = nat ? Math.min(1, (nat.w / nat.h) / (3 / 4)) : 1; // largura relativa quando a altura ocupa tudo
  const larg = nat ? (nat.w / nat.h >= 3 / 4 ? 1 : base) * zoom : zoom;
  const alt = nat ? (nat.w / nat.h >= 3 / 4 ? (3 / 4) / (nat.w / nat.h) : 1) * zoom : zoom;

  const down = (e: RPointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    toques.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (toques.current.size === 2) {
      const [a, b] = [...toques.current.values()];
      inicio.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  };
  const move = (e: RPointerEvent) => {
    const antes = toques.current.get(e.pointerId);
    if (!antes || !moldura.current) return;
    const r = moldura.current.getBoundingClientRect();
    toques.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (toques.current.size === 2 && inicio.current) {
      const [a, b] = [...toques.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      setZoom(Math.min(3, Math.max(0.5, (inicio.current.zoom * d) / (inicio.current.dist || 1))));
    } else if (toques.current.size === 1) {
      setPos((p) => ({ x: p.x + (e.clientX - antes.x) / r.width, y: p.y + (e.clientY - antes.y) / r.height }));
    }
  };
  const up = (e: RPointerEvent) => {
    toques.current.delete(e.pointerId);
    if (toques.current.size < 2) inicio.current = null;
  };

  const usar = async () => {
    if (!src || !nat) return;
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = SAIDA_W;
    c.height = SAIDA_H;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = FUNDO;
    ctx.fillRect(0, 0, c.width, c.height);
    const w = larg * SAIDA_W;
    const h = alt * SAIDA_H;
    const x = SAIDA_W / 2 + pos.x * SAIDA_W - w / 2;
    const y = SAIDA_H / 2 + pos.y * SAIDA_H - h / 2;
    ctx.drawImage(img, x, y, w, h);
    c.toBlob((b) => b && onPronto(b), 'image/jpeg', 0.9);
  };

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex flex-col bg-black p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" role="dialog" aria-label={`Ajustar foto ${titulo}`}>
      <p className="text-center text-sm font-semibold text-white">Ajustar foto · {titulo}</p>
      <p className="mb-3 text-center text-xs text-white/70">Arraste para mover. Use dois dedos ou a barra para aproximar e afastar.</p>
      <div className="flex flex-1 items-center justify-center overflow-hidden">
        <div
          ref={moldura}
          data-testid="ajustar-moldura"
          className="relative aspect-[3/4] h-full max-h-[65vh] max-w-full touch-none select-none overflow-hidden rounded-xl"
          style={{ background: FUNDO }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          {src && (
            <img
              src={src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none"
              style={{ width: `${larg * 100}%`, height: `${alt * 100}%`, left: `${50 + pos.x * 100}%`, top: `${50 + pos.y * 100}%`, transform: 'translate(-50%, -50%)' }}
            />
          )}
          <div className="pointer-events-none absolute inset-x-0 top-[6%] border-t border-dashed border-white/60"></div>
          <div className="pointer-events-none absolute inset-x-0 bottom-[4%] border-t border-dashed border-white/60"></div>
        </div>
      </div>
      <div className="mx-auto mt-3 flex w-full max-w-sm items-center gap-3">
        <i className="ri-zoom-out-line text-white"></i>
        <input type="range" min={0.5} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1" aria-label="Zoom" />
        <i className="ri-zoom-in-line text-white"></i>
      </div>
      <div className="mx-auto mt-3 flex w-full max-w-sm gap-2">
        <button type="button" onClick={onCancelar} className="flex-1 rounded-lg border border-white/40 px-4 py-2.5 text-sm font-semibold text-white">Cancelar</button>
        <button type="button" onClick={() => { setZoom(1); setPos({ x: 0, y: 0 }); }} className="rounded-lg border border-white/40 px-3 py-2.5 text-sm text-white" aria-label="Voltar ao início"><i className="ri-refresh-line"></i></button>
        <button type="button" onClick={() => void usar()} disabled={!nat} className="flex-1 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Usar foto</button>
      </div>
    </div>,
    document.body,
  );
}
