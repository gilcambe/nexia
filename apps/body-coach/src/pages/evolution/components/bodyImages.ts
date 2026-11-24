// Imagens do Body Twin em diferentes níveis de gordura corporal (vista frontal, fotorrealista).
// O Body Twin "evolui": conforme o % de gordura do aluno muda, escolhemos a imagem mais próxima.

export interface FatLevelImage {
  fat: number;
  src: string;
}

export const FAT_LEVEL_IMAGES: FatLevelImage[] = [
  {
    fat: 9,
    src: `${import.meta.env.BASE_URL}imagens/bt-progress-hoje.jpg`,
  },
  {
    fat: 12,
    src: `${import.meta.env.BASE_URL}imagens/bt-progress-hoje.jpg`,
  },
  {
    fat: 16,
    src: `${import.meta.env.BASE_URL}imagens/bt-real-frente.jpg`,
  },
  {
    fat: 20,
    src: `${import.meta.env.BASE_URL}imagens/bt-progress-mes1.jpg`,
  },
];

import { chaveDisponivel, type Avatar, type VistaCorpo } from '@/lib/avaliacao/avatar';
import ANCORAS from '@/lib/avaliacao/corposAncoras.json';

const EXISTE = (k: string) => k in (ANCORAS as Record<string, unknown>);
const ANTIGAS: Record<VistaCorpo, string> = {
  frente: `${import.meta.env.BASE_URL}imagens/bt-real-frente.jpg`,
  lado: `${import.meta.env.BASE_URL}imagens/bt-real-lado.jpg`,
  costas: `${import.meta.env.BASE_URL}imagens/bt-real-costas.jpg`,
};

// Corpo do Body Twin conforme o aluno: mulher vê corpo de mulher (com o tom de pele escolhido),
// no biotipo do % de gordura. Homem continua com as fotos de estúdio originais.
export function imagemDoCorpo(avatar: Avatar | null | undefined, gordura: number, vista: VistaCorpo, meta = false): string {
  if (!avatar || avatar.sexo === 'm') return vista === 'frente' ? pickBodyImage(gordura) : ANTIGAS[vista];
  const chave = chaveDisponivel(meta ? { ...avatar, biotipo: 'auto' } : avatar, gordura, vista, EXISTE);
  return chave ? `${import.meta.env.BASE_URL}imagens/corpos/${chave}.jpg` : ANTIGAS[vista];
}

// Escolhe a imagem cujo nível de gordura está mais próximo do % informado.
export function pickBodyImage(bodyFat: number): string {
  const sorted = [...FAT_LEVEL_IMAGES].sort(
    (a, b) => Math.abs(a.fat - bodyFat) - Math.abs(b.fat - bodyFat),
  );
  return sorted[0].src;
}

// Rótulo amigável do nível de gordura mais próximo (ex.: "~16%").
export function nearestFatLevel(bodyFat: number): number {
  const sorted = [...FAT_LEVEL_IMAGES].sort(
    (a, b) => Math.abs(a.fat - bodyFat) - Math.abs(b.fat - bodyFat),
  );
  return sorted[0].fat;
}