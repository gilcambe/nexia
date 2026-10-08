export interface Serie {
  weight: number;
  reps: number;
}

export function estimar1RM(serie: Serie): number {
  return serie.weight * (1 + serie.reps / 30);
}

export function ehRecorde(historico: Serie[], nova: Serie): boolean {
  if (historico.length === 0) {
    return true;
  }

  const maxWeight = Math.max(...historico.map((s) => s.weight));
  const max1RM = Math.max(...historico.map(estimar1RM));

  const novaWeight = nova.weight;
  const nova1RM = estimar1RM(nova);

  return novaWeight > maxWeight || nova1RM > max1RM;
}
