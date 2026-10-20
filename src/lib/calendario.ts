export const SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

export function temaDoDia(dia: string): string {
  // Temas fixos para cada dia da semana
  const temas: Record<string, string> = {
    'Segunda': 'Motivação e Começo de Semana',
    'Terça': 'Dicas de Treino',
    'Quarta': 'Nutrição e Alimentação',
    'Quinta': 'Resultados e Progresso',
    'Sexta': 'Preparação para o Fim de Semana',
    'Sábado': 'Lazer e Recuperação',
    'Domingo': 'Planejamento e Metas'
  };
  return temas[dia] || 'Tema do Dia';
}