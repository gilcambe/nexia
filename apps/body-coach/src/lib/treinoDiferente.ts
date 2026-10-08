export function treinoDiferente(planejado: string, escolhido: string): boolean {
  const normalizar = (texto: string): string =>
    texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const rotulos = [
    'pernas',
    'costas e biceps',
    'peito e triceps',
    'push',
    'pull',
    'legs',
    'corpo inteiro',
  ];

  const mapaGrupos: Record<string, string> = {
    pernas: 'pernas',
    'costas e biceps': 'costas e biceps',
    'peito e triceps': 'peito e triceps',
    push: 'peito e triceps',
    pull: 'costas e biceps',
    legs: 'pernas',
    'corpo inteiro': 'corpo inteiro',
  };

  const normalizarESearch = (texto: string): string =>
    texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  const normalizarPlanejado = normalizarESearch(planejado);
  const normalizadoEscolhido = normalizarESearch(escolhido);

  // Se ambos os rótulos já estão normalizados e são iguais, não são diferentes
  if (normalizarPlanejado === normalizadoEscolhido) return false;

  // Busca o grupo para cada rótulo
  const grupoPlanejado = mapaGrupo(normalizarPlanejado);
  const grupoEscolhido = mapaGrupo(normalizadoEscolhido);

  // Se algum não foi encontrado no mapa, compara as strings normalizadas diretamente
  if (!grupoPlanejado || !grupoEscolhido) {
    return normalizarPlanejado !== normalizadoEscolhido;
  }

  // Treinos diferentes se estiverem em grupos musculares distintos
  return grupoPlanejado !== grupoEscolhido;
}

function mapaGrupo(rotulo: string): string | undefined {
  for (const r of rotulos) {
    if (rotulo === r || rotulo.includes(r) || r.includes(rotulo)) {
      return mapaGrupos[r];
    }
  }
  return undefined;
}
