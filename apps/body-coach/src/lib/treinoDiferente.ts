export function treinoDiferente(planejado: string, escolhido: string): boolean {
  const normalizar = (texto: string): string =>
    texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const gruposPorRotulo: Record<string, string[]> = {
    pernas: ['pernas', 'legs', 'quadriceps', 'isquiotibiais', 'gluteos', 'glúteos', 'panturrilha', 'panturrilhas'],
    'costas e biceps': ['costas', 'costas e biceps', 'costas e bíceps', 'pull', 'dorsal', 'dorsais', 'trapezio', 'trapézio', 'romboide', 'romboides'],
    'peito e triceps': ['peito', 'peito e triceps', 'peito e tríceps', 'push', 'peitoral', 'peitorais', 'triceps', 'tríceps'],
    'corpo inteiro': ['corpo inteiro', 'full body', 'corpo todo'],
  };

  const rotuloNormalizado = normalizar(escolhido);
  const planejadoNormalizado = normalizar(planejado);

  const gruposEscolhido = Object.entries(gruposPorRotulo).find(([_, sinonimos]) =>
    sinonimos.some((s) => normalizar(s) === rotuloNormalizado)
  )?.[1];

  const gruposPlanejado = Object.entries(gruposPorRotulo).find(([_, sinonimos]) =>
    sinonimos.some((s) => normalizar(s) === planejadoNormalizado)
  )?.[1];

  // Fallback: se algum rótulo não está no mapeamento, considera treinos diferentes
  // quando as strings normalizadas forem distintas (comportamento conservador).
  if (!gruposEscolhido || !gruposPlanejado) {
    return rotuloNormalizado !== planejadoNormalizado;
  }

  const conjuntoEscolhido = new Set(gruposEscolhido.map(normalizar));
  const conjuntoPlanejado = new Set(gruposPlanejado.map(normalizar));

  for (const g of conjuntoEscolhido) {
    if (conjuntoPlanejado.has(g)) return false;
  }
  return true;
}
