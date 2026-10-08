// Sobrecarga progressiva: olha o melhor set do último treino desse exercício e sugere a carga de hoje.
// Bateu o topo das repetições -> sobe a carga; ficou abaixo da base duas vezes seguidas -> alivia; no meio -> mesma carga, mais uma repetição.
export interface SerieBest { weight: number; reps: number }
export interface Sugestao { weight: number; reps: number; motivo: string }

export function faixaDeReps(alvo: string): [number, number] {
  const n = (alvo.match(/\d+/g) ?? []).map(Number);
  if (!n.length) return [8, 12];
  return [n[0], n[n.length - 1]];
}

const arredonda = (kg: number) => Math.round(kg / 0.5) * 0.5;

// historico: melhores séries, da mais recente para a mais antiga.
export function sugerirCarga(historico: SerieBest[] | undefined, alvoReps: string): Sugestao | null {
  const ult = historico?.[0];
  if (!ult || !(ult.weight > 0) || !(ult.reps > 0)) return null;
  const [base, topo] = faixaDeReps(alvoReps);
  if (ult.reps >= topo) {
    const passo = ult.weight >= 40 ? 2.5 : ult.weight >= 10 ? 1 : 0.5;
    return { weight: arredonda(ult.weight + passo), reps: base, motivo: `Na última vez você fez ${ult.weight} kg × ${ult.reps}, bateu o topo. Hora de subir a carga.` };
  }
  const pen = historico?.[1];
  if (ult.reps < base && pen && pen.weight === ult.weight && pen.reps < base) {
    return { weight: arredonda(ult.weight * 0.95), reps: base, motivo: `Duas vezes abaixo de ${base} reps com ${ult.weight} kg. Alivie 5% e reconstrua.` };
  }
  return { weight: ult.weight, reps: Math.min(topo, Math.max(ult.reps + 1, base)), motivo: `Na última vez: ${ult.weight} kg × ${ult.reps}. Mantenha a carga e tente 1 repetição a mais.` };
}
