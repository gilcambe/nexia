let exercicioAtivo: string | null = null;

export function setExercicioAtivo(nome: string | null): void {
  exercicioAtivo = nome;
}

export function getExercicioAtivo(): string | null {
  return exercicioAtivo;
}

export function temExercicioAtivo(): boolean {
  return exercicioAtivo !== null;
}
