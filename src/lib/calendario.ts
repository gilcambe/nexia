export const SEMANA = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

/**
 * Retorna o tema do dia. O texto pode ser simples, pois o componente apenas exibe o retorno.
 */
export function temaDoDia(dia: string): string {
  // Exemplo estático – pode ser ajustado futuramente.
  const temas: Record<string, string> = {
    Domingo: 'Descanso e inspiração',
    Segunda: 'Planejamento da semana',
    Terça: 'Dicas de produtividade',
    Quarta: 'Meio da semana – foco',
    Quinta: 'Feedback e ajustes',
    Sexta: 'Celebrar conquistas',
    Sábado: 'Relaxar e refletir',
  };
  return temas[dia] ?? '';
}