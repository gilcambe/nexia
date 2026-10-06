export type SerieFeita = { carga: number; reps: number; rir?: number };

export function dicaAoVivo(p: {
  exercicio: string;
  repsAlvo: [number, number];
  seriesPlanejadas: number;
  feitas: SerieFeita[];
  ultimaSessao?: SerieFeita[];
  descansoSeg: number;
}): { texto: string; descansoSeg: number; alerta: boolean } {
  const { exercicio, repsAlvo, seriesPlanejadas, feitas, ultimaSessao, descansoSeg } = p;
  const numFeitas = feitas.length;
  const [minReps, maxReps] = repsAlvo;

  // Caso ainda não tenha feito nenhuma série
  if (numFeitas === 0) {
    let textoBase = `Preparando para ${exercicio}. Alvo: ${minReps}-${maxReps} reps.`;
    if (ultimaSessao && ultimaSessao.length > 0) {
      const ultimaCarga = ultimaSessao[0].carga;
      const ultimasReps = ultimaSessao[0].reps;
      textoBase += ` Última sessão: ${ultimaCarga}kg x ${ultimasReps} reps.`;
    }
    return {
      texto: textoBase,
      descansoSeg: descansoSeg > 0 ? descansoSeg : 90,
      alerta: false
    };
  }

  const ultimaSerie = feitas[numFeitas - 1];
  const { carga, reps, rir } = ultimaSerie;

  // Verificar se atingiu o teto de reps (sobrecarga progressiva)
  if (reps >= maxReps && (rir === undefined || rir >= 1)) {
    return {
      texto: `Excelente série em ${exercicio}! Você atingiu ${reps} reps (meta ${minReps}-${maxReps}). Sugestão: aumente a carga na próxima série ou mantenha focando na técnica.`,
      descansoSeg: descansoSeg > 0 ? descansoSeg : 90,
      alerta: false
    };
  }

  // Verificar se ficou abaixo do mínimo de reps
  if (reps < minReps) {
    return {
      texto: `Atenção em ${exercicio}: ${reps} reps ficou abaixo do mínimo (${minReps}). Se a fadiga estiver alta, considere reduzir levemente a carga para manter a faixa alvo.`,
      descansoSeg: descansoSeg > 0 ? descansoSeg + 30 : 120,
      alerta: true
    };
  }

  // Verificar RIR muito baixo ou zero (falha precoce / esforço máximo)
  if (rir !== undefined && rir === 0 && numFeitas < seriesPlanejadas) {
    return {
      texto: `Série intensa em ${exercicio} com RIR 0! Como ainda restam séries planejadas, fique atento ao descanso para não cair o rendimento.`,
      descansoSeg: descansoSeg > 0 ? descansoSeg + 30 : 120,
      alerta: true
    };
  }

  // Fim do treino / séries planejadas atingidas ou ultrapassadas
  if (numFeitas >= seriesPlanejadas) {
    return {
      texto: `Parabéns! Você concluiu as ${seriesPlanejadas} séries planejadas de ${exercicio}. Bom trabalho!`,
      descansoSeg: 0,
      alerta: false
    };
  }

  // Caso padrão dentro da faixa
  return {
    texto: `Boa série em ${exercicio}: ${carga}kg x ${reps} reps (Alvo: ${minReps}-${maxReps}). Mantenha o ritmo!`,
    descansoSeg: descansoSeg > 0 ? descansoSeg : 90,
    alerta: false
  };
}
