// Corpo realista com as medidas do aluno: a foto do Body Twin (corpo de verdade) é "esticada" ou
// "afinada" faixa por faixa (ombros, peito, cintura, quadril, coxas, panturrilhas) conforme as
// circunferências medidas comparadas com as de um corpo típico da mesma altura e peso. Puro.
import { medidasDoCorpo } from './corpo.ts';
import type { Sexo } from './calculos.ts';

export type ParteCorpo = 'ombro' | 'torax' | 'cintura' | 'quadril' | 'coxa' | 'panturrilha';

// Altura de cada parte na foto (fração da altura da imagem, de cima para baixo).
export const ALTURA_NA_FOTO: Record<ParteCorpo, number> = {
  ombro: 0.22, torax: 0.29, cintura: 0.43, quadril: 0.54, coxa: 0.68, panturrilha: 0.84,
};

// Campo da avaliação que cada parte usa (o primeiro que existir).
export const CAMPO_DA_PARTE: Record<ParteCorpo, string[]> = {
  ombro: ['ombro'],
  torax: ['torax'],
  cintura: ['cintura', 'abdomen'],
  quadril: ['quadril'],
  coxa: ['coxa_medial', 'coxa_proximal', 'coxa_medial_d', 'coxa_proximal_d'],
  panturrilha: ['panturrilha', 'panturrilha_d'],
};

export const NOME_DA_PARTE: Record<ParteCorpo, string> = {
  ombro: 'Ombros', torax: 'Peitoral', cintura: 'Cintura', quadril: 'Quadril', coxa: 'Coxas', panturrilha: 'Panturrilhas',
};

const lim = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

export interface FormaCorpo {
  geral: number; // largura geral pelo IMC (1 = corpo da foto)
  partes: Record<ParteCorpo, { fator: number; medida: number | null }>;
}

export function formaDoCorpo(valores: Record<string, number>, sexo: Sexo | null | undefined, alturaPerfil?: number | null): FormaCorpo {
  const altura = valores.altura ?? alturaPerfil ?? 175;
  const peso = valores.peso ?? null;
  const imc = peso ? peso / (altura / 100) ** 2 : 24;
  const geral = lim((imc / 23) ** 0.75, 0.85, 1.25);
  const tipico = medidasDoCorpo({ altura, ...(peso ? { peso } : {}) }, sexo, altura) as unknown as Record<string, number>;
  const partes = {} as FormaCorpo['partes'];
  for (const p of Object.keys(ALTURA_NA_FOTO) as ParteCorpo[]) {
    const medida = CAMPO_DA_PARTE[p].map((k) => valores[k]).find((n) => n != null && Number.isFinite(n)) ?? null;
    const ref = tipico[p === 'cintura' ? 'cintura' : p];
    // Exagera um pouco a diferença para ela aparecer na foto (a largura não é linear com a circunferência).
    partes[p] = { medida, fator: medida && ref ? lim((medida / ref) ** 1.6, 0.75, 1.35) : 1 };
  }
  return { geral, partes };
}

// Quanto esticar a linha y (0 = topo, 1 = pé). A cabeça quase não muda; entre as partes, transição suave.
export function escalaNaAltura(forma: FormaCorpo, y: number): number {
  const pts = (Object.keys(ALTURA_NA_FOTO) as ParteCorpo[])
    .map((p) => ({ y: ALTURA_NA_FOTO[p], f: forma.partes[p].fator * forma.geral }))
    .sort((a, b) => a.y - b.y);
  const cabeca = 1 + (forma.geral - 1) * 0.25;
  const ancoras = [{ y: 0, f: cabeca }, { y: 0.15, f: cabeca }, ...pts, { y: 1, f: pts[pts.length - 1].f }];
  for (let i = 0; i < ancoras.length - 1; i += 1) {
    const a = ancoras[i];
    const b = ancoras[i + 1];
    if (y >= a.y && y <= b.y) {
      const t = (y - a.y) / (b.y - a.y || 1);
      const s = t * t * (3 - 2 * t);
      return a.f + (b.f - a.f) * s;
    }
  }
  return 1;
}
