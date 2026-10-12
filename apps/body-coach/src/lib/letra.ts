// Tamanho da letra do app inteiro (escolha de cada pessoa, guardada no celular). Muda a base do rem:
// textos, botões e espaços crescem juntos, sem quebrar o layout.
export type TamanhoLetra = 'normal' | 'grande' | 'enorme';
export const TAMANHOS: { id: TamanhoLetra; nome: string; pct: number }[] = [
  { id: 'normal', nome: 'Normal', pct: 100 },
  { id: 'grande', nome: 'Grande', pct: 112.5 },
  { id: 'enorme', nome: 'Muito grande', pct: 125 },
];
const CHAVE = 'bc_letra';

export function letraGuardada(): TamanhoLetra {
  try { const v = localStorage.getItem(CHAVE); return TAMANHOS.some((t) => t.id === v) ? (v as TamanhoLetra) : 'normal'; } catch { return 'normal'; }
}

export function aplicarLetra(t: TamanhoLetra = letraGuardada()): void {
  const pct = TAMANHOS.find((x) => x.id === t)?.pct ?? 100;
  document.documentElement.style.fontSize = pct === 100 ? '' : `${pct}%`;
}

export function definirLetra(t: TamanhoLetra): void {
  try { localStorage.setItem(CHAVE, t); } catch { /* sem armazenamento */ }
  aplicarLetra(t);
}
