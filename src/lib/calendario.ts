/**
 * Os 7 dias da semana, começando no domingo.
 * Usado por Divulgar.tsx para listar o tema e os horários de cada dia.
 */
export const SEMANA = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

/**
 * Temas de cada dia da semana.
 */
const TEMAS: Record<string, string> = {
  Domingo: 'Descanso e inspiração',
  Segunda: 'Planejamento da semana',
  Terça: 'Dicas de produtividade',
  Quarta: 'Meio da semana – foco',
  Quinta: 'Feedback e ajustes',
  Sexta: 'Celebrar conquistas',
  Sábado: 'Relaxar e refletir',
};

/**
 * Retorna o tema do dia. O texto pode ser simples, pois o componente apenas exibe o retorno.
 * Aceita o nome do dia em qualquer caixa ("terça", "Terça") e devolve '' quando não há tema.
 */
export function temaDoDia(dia: string): string {
  // Exemplo estático – pode ser ajustado futuramente.
  if (!dia) return '';
  const chave = dia.trim().toLowerCase().replace(/^./, (c) => c.toUpperCase());
  return TEMAS[chave] ?? '';
}