/**
 * Módulo de Avaliação de Modelos do Cortex (CommonJS)
 */

/**
 * Avalia uma lista de execuções de modelos.
 * @param {Array<{modelo: string, ok: boolean}>} execucoes - Lista de execuções.
 * @returns {Array<{modelo: string, total: number, acertos: number, taxa: number}>} Lista ordenada do melhor para o pior.
 */
function avaliarModelos(execucoes) {
  if (!Array.isArray(execucoes)) {
    return [];
  }

  const map = {};

  for (const exec of execucoes) {
    if (!exec || !exec.modelo) continue;
    const nome = exec.modelo;
    if (!map[nome]) {
      map[nome] = { modelo: nome, total: 0, acertos: 0 };
    }
    map[nome].total += 1;
    if (exec.ok === true) {
      map[nome].acertos += 1;
    }
  }

  const resultados = [];
  for (const nome in map) {
    const item = map[nome];
    // Ignorar modelos com menos de 3 execuções
    if (item.total < 3) {
      continue;
    }
    const taxa = item.total > 0 ? item.acertos / item.total : 0;
    resultados.push({
      modelo: item.modelo,
      total: item.total,
      acertos: item.acertos,
      taxa
    });
  }

  // Ordenar do melhor para o pior: taxa decrescente, desempate por total decrescente
  resultados.sort((a, b) => {
    if (b.taxa !== a.taxa) {
      return b.taxa - a.taxa;
    }
    return b.total - a.total;
  });

  return resultados;
}

/**
 * Reordena uma lista de modelos com base na avaliação prévia.
 * Modelos sem avaliação ficam no fim.
 * @param {Array<{modelo: string, taxa: number}>} avaliacao - Lista de resultados de avaliação.
 * @param {Array<string>} modelos - Lista completa de modelos disponíveis.
 * @returns {Array<string>} Modelos reordenados.
 */
function ordemDeTentativa(avaliacao, modelos) {
  if (!Array.isArray(modelos)) {
    return [];
  }
  if (!Array.isArray(avaliacao)) {
    return [...modelos];
  }

  // Mapear taxas conhecidas
  const taxaMap = {};
  for (const item of avaliacao) {
    if (item && item.modelo) {
      taxaMap[item.modelo] = typeof item.taxa === 'number' ? item.taxa : -1;
    }
  }

  // Separar modelos avaliados dos não avaliados
  const avaliados = [];
  const naoAvaliados = [];

  for (const m of modelos) {
    if (Object.prototype.hasOwnProperty.call(taxaMap, m)) {
      avaliados.push({ modelo: m, taxa: taxaMap[m] });
    } else {
      naoAvaliados.export ? naoAvaliados.push(m) : naoAvaliados.push(m);
    }
  }

  // Ordenar avaliados pela taxa (decrescente)
  avaliados.sort((a, b) => b.taxa - a.taxa);

  return [
    ...avaliados.map(item => item.modelo),
    ...naoAvaliados
  ];
}

module.exports = {
    avaliarModelos,
    ordemDeTentativa
};
