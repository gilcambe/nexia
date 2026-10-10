import { useEffect, useMemo, useRef, useState } from 'react';
import { ALTURA_NA_FOTO, CAMPO_DA_PARTE, NOME_DA_PARTE, escalaNaAltura, formaDoCorpo, type ParteCorpo } from '@/lib/avaliacao/corpoRealista';
import type { Sexo } from '@/lib/avaliacao/calculos';
import { pickBodyImage } from '../components/bodyImages';
import EditarMedida from '../components/EditarMedida';

type Vista = 'frente' | 'lado' | 'costas';
const IMG: Record<Exclude<Vista, 'frente'>, string> = {
  lado: `${import.meta.env.BASE_URL}imagens/bt-real-lado.jpg`,
  costas: `${import.meta.env.BASE_URL}imagens/bt-real-costas.jpg`,
};
const MEIO_CORPO = 0.28; // metade da largura do corpo (com braços) na foto, em fração da largura

// O Body Twin realista moldado com as medidas do aluno (fita métrica + peso e altura).
export default function CorpoRealista({ valores, sexo, altura, gordura, onSalvarMedida, legenda }: {
  valores: Record<string, number>;
  sexo: Sexo | null | undefined;
  altura: number | null;
  gordura: number | null;
  onSalvarMedida?: (campo: string, cm: number) => Promise<void>;
  legenda?: string;
}) {
  const [vista, setVista] = useState<Vista>('frente');
  const [parte, setParte] = useState<ParteCorpo | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const forma = useMemo(() => formaDoCorpo(valores, sexo, altura), [valores, sexo, altura]);
  const src = vista === 'frente' ? pickBodyImage(gordura ?? 16) : IMG[vista];

  useEffect(() => {
    let vivo = true;
    const img = new Image();
    img.onload = () => {
      const c = canvas.current;
      if (!vivo || !c) return;
      const W = img.naturalWidth;
      const H = img.naturalHeight;
      c.width = W;
      c.height = H;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const cx = W / 2;
      const b = W * MEIO_CORPO;
      for (let y = 0; y < H; y += 1) {
        const s = escalaNaAltura(forma, y / H);
        const bs = Math.min(cx - 1, b * s);
        ctx.drawImage(img, 0, y, cx - b, 1, 0, y, cx - bs, 1);
        ctx.drawImage(img, cx - b, y, 2 * b, 1, cx - bs, y, 2 * bs, 1);
        ctx.drawImage(img, cx + b, y, W - cx - b, 1, cx + bs, y, W - cx - bs, 1);
      }
    };
    img.src = src;
    return () => { vivo = false; };
  }, [src, forma]);

  const medidas = (Object.keys(ALTURA_NA_FOTO) as ParteCorpo[]).filter((p) => forma.partes[p].medida != null).length;

  return (
    <div>
      <div className="relative mx-auto aspect-[592/800] w-full max-w-[290px] overflow-hidden rounded-2xl bg-[#c9c9c9]" data-testid="corpo-realista">
        <canvas ref={canvas} className="h-full w-full" aria-label="Seu corpo realista com as suas medidas" role="img" />
        {vista === 'frente' && (Object.keys(ALTURA_NA_FOTO) as ParteCorpo[]).map((p) => {
          const ativo = parte === p;
          const m = forma.partes[p].medida;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setParte(ativo ? null : p)}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: '50%', top: `${ALTURA_NA_FOTO[p] * 100}%` }}
              aria-label={`${onSalvarMedida ? 'Medir' : 'Ver medida'}: ${NOME_DA_PARTE[p]}`}
            >
              <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${ativo ? 'border-primary-500 bg-primary-500 text-white' : m != null ? 'border-white bg-black/40 text-white' : 'border-white bg-primary-500/80 text-white'}`}>
                <i className={m != null ? 'ri-ruler-line text-[11px]' : 'ri-add-line text-[12px]'}></i>
              </span>
              <span className={`pointer-events-none absolute left-7 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-semibold ${ativo ? 'bg-primary-500 text-white' : 'bg-black/60 text-white'}`}>
                {NOME_DA_PARTE[p]}{m != null ? ` · ${m.toLocaleString('pt-BR')} cm` : ''}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex justify-center gap-1.5">
        {(['frente', 'lado', 'costas'] as const).map((v) => (
          <button key={v} type="button" onClick={() => setVista(v)} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${vista === v ? 'bg-foreground-900 text-background-50' : 'bg-background-100 text-foreground-700'}`}>
            {v === 'frente' ? 'Frente' : v === 'lado' ? 'Lado' : 'Costas'}
          </button>
        ))}
      </div>
      {parte && (
        <div className="mt-2">
          {onSalvarMedida ? (
            <EditarMedida
              key={parte}
              nome={NOME_DA_PARTE[parte]}
              atual={forma.partes[parte].medida}
              onFechar={() => setParte(null)}
              onSalvar={(cm) => onSalvarMedida(CAMPO_DA_PARTE[parte][0], cm)}
            />
          ) : (
            <p className="text-center text-xs text-foreground-600">{NOME_DA_PARTE[parte]}: {forma.partes[parte].medida != null ? `${forma.partes[parte].medida!.toLocaleString('pt-BR')} cm` : 'sem medida'}</p>
          )}
        </div>
      )}
      <p className="mt-2 text-[11px] text-foreground-500">
        {legenda ?? `Corpo realista moldado com o seu peso, altura e ${medidas} de 6 medidas da fita.`} {onSalvarMedida && medidas < 6 ? 'Toque no + para colocar as que faltam.' : ''}
      </p>
    </div>
  );
}
