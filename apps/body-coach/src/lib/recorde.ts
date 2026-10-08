export function estimar1RM(serie: { weight: number; reps: number }): number {
  return serie.weight * (1 + serie.reps / 30);
}

export function ehRecorde(
  historico: { weight: number; reps: number }[],
  nova: { weight: number; reps: number }
): boolean {
  if (!historico || historico.length === 0) {
    return true;
  }

  const maiorCargaHistorico = Math.max(...historico.map((s) => s.weight));
  const maior1RMHistorico = Math.max(...historico.map(estimar1RM));

  const cargaNova = nova.weight;
  const rmNova = estimar1RM(nova);

  return cargaNova > maiorCargaHistorico || rmNova > maior1RMHistorico;
}
