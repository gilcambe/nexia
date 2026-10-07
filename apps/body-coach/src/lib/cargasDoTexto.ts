export interface SerieRegistrada {
  peso?: number;
  repeticoes?: number;
  observacao?: string;
}

export interface ResultadoCargas {
  exercicioNome?: string;
  series: SerieRegistrada[];
}

export function cargasDoTexto(texto: string): ResultadoCargas | null {
  if (!texto || typeof texto !== 'string') return null;
  const lower = texto.toLowerCase();

  // Regex simples para capturar padrões como "fiz 12 com 70", "10x50kg", "8 repetições com 40kg", "12 reps de 60"
  // ou simplesmente repetições e peso.
  const matchReps = lower.match(/(\d+)\s*(?:reps?|repeti[cç][õo]es|x)/i);
  const matchPeso = lower.match(/(?:com|de|\b)\s*(\d+(?:[.,]\d+)?)\s*(?:kg|quilos)?/i);

  const reps = matchReps ? parseInt(matchReps[1], 10) : undefined;
  
  // Tenta extrair peso após "com" ou "kg"
  let peso: number | undefined = undefined;
  const matchKg = lower.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  if (matchKg) {
    peso = parseFloat(matchKg[1].replace(',', '.'));
  } else if (matchPeso && matchReps) {
    // Pega o número que aparece depois
    const idxReps = matchReps.index || 0;
    const sub = lower.substring(idxReps + matchReps[0].length);
    const mP = sub.match(/(\d+(?:[.,]\d+)?)/);
    if (mP) {
      peso = parseFloat(mP[1].replace(',', '.'));
    }
  }

  if (reps === undefined && peso === undefined) {
    return null;
  }

  return {
    series: [
      {
        peso,
        repeticoes: reps,
        observacao: texto,
      },
    ],
  };
}
