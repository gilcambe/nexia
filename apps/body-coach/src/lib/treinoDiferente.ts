/**
 * Compara dois rótulos de treino e retorna true se forem diferentes
 * considerando grupos musculares equivalentes.
 */
export function treinoDiferente(planejado: string, escolhido: string): boolean {
  // Normaliza: minúsculas, remove acentos, trim
  const normalize = (s: string): string =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  // Mapeia rótulos para conjunto de grupos musculares canônicos
  const mapLabelToGroups = (label: string): Set<string> => {
    const normalized = normalize(label);
    const groups = new Set<string>();

    // Pernas / Legs / Quadríceps / Posterior / Glúteos / Panturrilha
    if (
      normalized.includes('perna') ||
      normalized.includes('leg') ||
      normalized.includes('quadriceps') ||
      normalized.includes('quadricep') ||
      normalized.includes('posterior') ||
      normalized.includes('hamstring') ||
      normalized.includes('gluteo') ||
      normalized.includes('glute') ||
      normalized.includes('panturrilha') ||
      normalized.includes('calf')
    ) {
      groups.add('pernas');
    }

    // Costas / Back / Dorsal / Trapézio / Lombar
    if (
      normalized.includes('costas') ||
      normalized.includes('back') ||
      normalized.includes('dorsal') ||
      normalized.includes('trapezio') ||
      normalized.includes('trapezius') ||
      normalized.includes('lombar') ||
      normalized.includes('lower back')
    ) {
      groups.add('costas');
    }

    // Bíceps / Braço anterior
    if (
      normalized.includes('biceps') ||
      normalized.includes('bíceps') ||
      normalized.includes('braco anterior') ||
      normalized.includes('front arm')
    ) {
      groups.add('biceps');
    }

    // Peito / Chest / Peitoral
    if (
      normalized.includes('peito') ||
      normalized.includes('chest') ||
      normalized.includes('peitoral')
    ) {
      groups.add('peito');
    }

    // Tríceps / Braço posterior
    if (
      normalized.includes('triceps') ||
      normalized.includes('tríceps') ||
      normalized.includes('braco posterior') ||
      normalized.includes('back arm')
    ) {
      groups.add('triceps');
    }

    // Ombro / Shoulder / Deltóide
    if (
      normalized.includes('ombro') ||
      normalized.includes('shoulder') ||
      normalized.includes('deltoide') ||
      normalized.includes('deltoid')
    ) {
      groups.add('ombro');
    }

    // Core / Abdominal / Core
    if (
      normalized.includes('core') ||
      normalized.includes('abdominal') ||
      normalized.includes('abs') ||
      normalized.includes('abdomem')
    ) {
      groups.add('core');
    }

    // Push / Empurrar
    if (normalized === 'push' || normalized.includes('push') || normalized.includes('empurrar')) {
      groups.add('peito');
      groups.add('ombro');
      groups.add('triceps');
    }

    // Pull / Puxar
    if (normalized === 'pull' || normalized.includes('pull') || normalized.includes('puxar')) {
      groups.add('costas');
      groups.add('biceps');
      groups.add('ombro'); // posterior deltoid often in pull
    }

    // Legs (já coberto acima, mas garante)
    if (normalized === 'legs' || normalized.includes('legs')) {
      groups.add('pernas');
    }

    // Corpo inteiro / Full body
    if (
      normalized.includes('corpo inteiro') ||
      normalized.includes('full body') ||
      normalized.includes('corpo todo')
    ) {
      groups.add('pernas');
      groups.add('costas');
      groups.add('peito');
      groups.add('ombro');
      groups.add('biceps');
      groups.add('triceps');
      groups.add('core');
    }

    return groups;
  };

  const gruposPlanejado = mapLabelToGroups(planejado);
  const gruposEscolhido = mapLabelToGroups(escolhido);

  // Se os conjuntos de grupos musculares forem iguais, não é diferente
  if (gruposPlanejado.size === gruposEscolhido.size) {
    let iguais = true;
    for (const g of gruposPlanejado) {
      if (!gruposEscolhido.has(g)) {
        iguais = false;
        break;
      }
    }
    if (iguais) return false;
  }

  return true;
}
