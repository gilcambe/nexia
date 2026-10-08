const normalizar = (texto: string): string =>
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

// Mapeamento de rótulo normalizado -> grupos musculares (array de sinônimos por grupo)
const mapaGrupos: Record<string, readonly string[]> = {
  pernas: ['pernas', 'quadriceps', 'quadríceps', 'posterior de coxa', 'gluteos', 'glúteos', 'panturrilha'],
  'costas e biceps': ['costas', 'dorsal', 'trapezio', 'trapézio', 'biceps', 'bíceps', 'antebraco', 'antebraço'],
  'peito e triceps': ['peito', 'peitoral', 'triceps', 'tríceps', 'ombro', 'deltoide'],
  push: ['peito', 'peitoral', 'triceps', 'tríceps', 'ombro', 'deltoide'],
  pull: ['costas', 'dorsal', 'trapezio', 'trapézio', 'biceps', 'bíceps', 'antebraco', 'antebraço'],
  legs: ['pernas', 'quadriceps', 'quadríceps', 'posterior de coxa', 'gluteos', 'glúteos', 'panturrilha'],
  'corpo inteiro': ['corpo inteiro', 'full body', 'todo o corpo'],
  'full body': ['corpo inteiro', 'full body', 'todo o corpo'],
};

// Lista de rótulos válidos derivada das chaves do mapa (evita divergência)
const rotulos = Object.keys(mapaGrupos) as const;

/**
 * Mapeia um rótulo normalizado para seu grupo muscular.
 * Retorna undefined se o rótulo não for reconhecido.
 */
function mapaGrupo(rotulo: string): readonly string[] | undefined {
  return mapaGrupos[rotulo];
}

/**
 * Verifica se dois treinos são de grupos musculares diferentes.
 * Normaliza (minúsculas, sem acento) e compara via grupos musculares.
 * Fallback conservador: se algum rótulo não estiver no mapa, compara strings normalizadas.
 */
export function treinoDiferente(planejado: string, escolhido: string): boolean {
  const normalizadoPlanejado = normalizar(planejado);
  const normalizadoEscolhido = normalizar(escolhido);

  // Se ambos os rótulos já estão normalizados e são iguais, não são diferentes
  if (normalizadoPlanejado === normalizadoEscolhido) return false;

  // Busca o grupo para cada rótulo (matching exato via chave do mapa)
  const grupoPlanejado = mapaGrupo(normalizadoPlanejado);
  const grupoEscolhido = mapaGrupo(normalizadoEscolhido);

  // Se algum não foi encontrado no mapa, fallback conservador: strings diferentes = treinos diferentes
  if (!grupoPlanejado || !grupoEscolhido) {
    return normalizadoPlanejado !== normalizadoEscolhido;
  }

  // Verifica interseção entre os grupos musculares
  const temIntersecao = grupoPlanejado.some((g) => grupoEscolhido.includes(g));

  // Treinos diferentes se NÃO houver interseção entre os grupos musculares
  return !temIntersecao;
}
