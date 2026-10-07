export interface ExercicioAtivo {
  id: string;
  nome: string;
  series: Array<{ peso?: number; repeticoes?: number; observacao?: string }>;
}

let exercicioAtivoAtual: ExercicioAtivo | null = null;

export function getTreinoAtivo(): ExercicioAtivo | null {
  return exercicioAtivoAtual;
}

export function setTreinoAtivo(exercicio: ExercicioAtivo | null) {
  exercicioAtivoAtual = exercicio;
}

export function registrarSerieNoTreinoAtivo(serie: { peso?: number; repeticoes?: number; observacao?: string }): boolean {
  if (!exercicioAtivoAtual) return false;
  exercicioAtivoAtual.series.push(serie);
  return true;
}
