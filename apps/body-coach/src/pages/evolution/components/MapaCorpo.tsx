import { useState } from 'react';

// Mapa do corpo: frente e costas, cada músculo pintado pelas séries dos últimos 7 dias.
// Toque no músculo para ver o número. Cinza = não treinou; quanto mais forte a cor, mais séries.

const NOMES: Record<string, string> = {
  peito: 'Peito', costas: 'Costas', ombros: 'Ombros', biceps: 'Bíceps', triceps: 'Tríceps', quadriceps: 'Quadríceps',
  posterior: 'Posterior de coxa', gluteos: 'Glúteos', panturrilha: 'Panturrilha', abdomen: 'Abdômen',
};

export function faixaSeries(n: number): { cor: string; texto: string } {
  if (n >= 18) return { cor: 'oklch(var(--primary-700))', texto: 'muito (acima de 18: cuidado com excesso)' };
  if (n >= 10) return { cor: 'oklch(var(--primary-500))', texto: 'ideal (10 a 18)' };
  if (n >= 5) return { cor: 'oklch(var(--primary-400))', texto: 'bom (5 a 9)' };
  if (n > 0) return { cor: 'oklch(var(--primary-200))', texto: 'pouco (1 a 4)' };
  return { cor: 'oklch(var(--background-300))', texto: 'não treinou' };
}

type Forma = { g: string; d: string };
const el = (cx: number, cy: number, rx: number, ry: number) => `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0`;
const ret = (x: number, y: number, w: number, h: number, r: number) => `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;

function silhueta(dx: number) {
  return [
    el(50 + dx, 17, 9, 10), ret(46 + dx, 25, 8, 6, 2), ret(34 + dx, 30, 32, 66, 9),
    ret(22 + dx, 33, 10, 64, 5), ret(68 + dx, 33, 10, 64, 5), ret(35 + dx, 94, 14, 110, 6), ret(51 + dx, 94, 14, 110, 6),
  ];
}
const FRENTE: Forma[] = [
  { g: 'ombros', d: el(30, 37, 7, 6) }, { g: 'ombros', d: el(70, 37, 7, 6) },
  { g: 'peito', d: ret(36, 39, 13.5, 17, 5) }, { g: 'peito', d: ret(50.5, 39, 13.5, 17, 5) },
  { g: 'biceps', d: el(27, 54, 4.5, 10) }, { g: 'biceps', d: el(73, 54, 4.5, 10) },
  { g: 'abdomen', d: ret(41, 59, 18, 33, 4) },
  { g: 'quadriceps', d: el(42, 126, 6, 22) }, { g: 'quadriceps', d: el(58, 126, 6, 22) },
  { g: 'panturrilha', d: el(42, 174, 4.5, 14) }, { g: 'panturrilha', d: el(58, 174, 4.5, 14) },
];
const COSTAS: Forma[] = [
  { g: 'ombros', d: el(130, 37, 7, 6) }, { g: 'ombros', d: el(170, 37, 7, 6) },
  { g: 'costas', d: 'M136 38 L164 38 L160 82 L140 82 Z' },
  { g: 'triceps', d: el(127, 55, 4.5, 10) }, { g: 'triceps', d: el(173, 55, 4.5, 10) },
  { g: 'gluteos', d: el(143, 101, 7.5, 8) }, { g: 'gluteos', d: el(157, 101, 7.5, 8) },
  { g: 'posterior', d: el(142, 133, 6, 19) }, { g: 'posterior', d: el(158, 133, 6, 19) },
  { g: 'panturrilha', d: el(142, 173, 5.5, 14) }, { g: 'panturrilha', d: el(158, 173, 5.5, 14) },
];

export default function MapaCorpo({ series }: { series: Record<string, number> }) {
  const [sel, setSel] = useState<string | null>(null);
  const n = (g: string) => Number(series[g] || 0);
  const forma = (f: Forma, i: number) => (
    <path key={`${f.g}-${i}`} d={f.d} fill={faixaSeries(n(f.g)).cor} stroke={sel === f.g ? 'oklch(var(--foreground-950))' : 'oklch(var(--background-50))'} strokeWidth={sel === f.g ? 1.6 : 0.8}
      onClick={() => setSel(sel === f.g ? null : f.g)} style={{ cursor: 'pointer' }} role="button" aria-label={`${NOMES[f.g]}: ${n(f.g)} séries`} data-grupo={f.g} />
  );
  return (
    <div data-testid="mapa-corpo">
      <svg viewBox="0 0 200 222" className="mx-auto block w-full max-w-[320px]" role="img" aria-label="Mapa do corpo com as séries da semana">
        {[...silhueta(0), ...silhueta(100)].map((d, i) => <path key={i} d={d} fill="oklch(var(--background-200))" />)}
        {FRENTE.map(forma)}
        {COSTAS.map(forma)}
        <text x="50" y="218" textAnchor="middle" fontSize="9" fill="oklch(var(--foreground-500))">Frente</text>
        <text x="150" y="218" textAnchor="middle" fontSize="9" fill="oklch(var(--foreground-500))">Costas</text>
      </svg>
      <p className="mt-1 min-h-[1.5rem] text-center text-sm text-foreground-700" aria-live="polite">
        {sel ? <><strong>{NOMES[sel]}</strong>: {n(sel)} séries · {faixaSeries(n(sel)).texto}</> : 'Toque num músculo para ver as séries da semana.'}
      </p>
      <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-foreground-600">
        {[0, 1, 5, 10, 18].map((v) => (
          <span key={v} className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: faixaSeries(v).cor }}></span>{v === 0 ? '0' : v === 18 ? '18+' : v === 1 ? '1-4' : v === 5 ? '5-9' : '10-17'}</span>
        ))}
      </div>
    </div>
  );
}
