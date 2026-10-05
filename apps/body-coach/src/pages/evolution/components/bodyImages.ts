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