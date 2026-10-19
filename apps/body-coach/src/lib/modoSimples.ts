// Modo simples da tela Hoje: só 3 cartões (treino de hoje, refeição de hoje, próxima ação) e o botão "Ver tudo".
// "Ver tudo" mostra a tela completa de antes (nada foi removido) e fica lembrado neste aparelho.
export const CHAVE_VER_TUDO = 'bc_home_ver_tudo';

export function verTudoGuardado(): boolean {
  try { return localStorage.getItem(CHAVE_VER_TUDO) === '1'; } catch { return false; }
}
export function guardarVerTudo(v: boolean): void {
  try { if (v) localStorage.setItem(CHAVE_VER_TUDO, '1'); else localStorage.removeItem(CHAVE_VER_TUDO); } catch { /* sem armazenamento */ }
}

export interface ProximaAcao { titulo: string; texto: string; icone: string; rota?: string; acao?: 'checkin' }

// A próxima coisa que o aluno deve fazer agora, na ordem: montar o plano, check-in do dia, treinar, registrar refeição.
export function proximaAcao(e: { onboarding: boolean; checkinHoje: boolean; hora: number }): ProximaAcao {
  if (!e.onboarding) return { titulo: 'Monte seu plano em 1 minuto', texto: 'Responda 4 perguntas e saia com treino e dieta prontos.', icone: 'ri-magic-line', rota: '/onboarding' };
  if (!e.checkinHoje) return { titulo: 'Faça o check-in de hoje', texto: 'Diga como acordou: o treino se ajusta ao seu dia.', icone: 'ri-heart-pulse-line', acao: 'checkin' };
  if (e.hora >= 21) return { titulo: 'Registre a última refeição', texto: 'Marque o que comeu hoje para fechar o dia.', icone: 'ri-restaurant-line', rota: '/nutrition' };
  return { titulo: 'Bora treinar', texto: 'Abra o treino de hoje e marque cada série.', icone: 'ri-play-fill', rota: '/workout' };
}
