// A equipe como comunidade: pontos por refeição/check-in, ranking de progressão de carga e o feed da equipe.
import { chatApi } from './chat';

// Conta pontos no ranking da equipe (sem equipe, o servidor recusa e ninguém percebe).
export function marcarPontos(tipo: 'refeicao' | 'checkin') {
  void chatApi({ acao: 'pontos_marcar', tipo }).catch(() => undefined);
}

export interface LinhaCarga { nome: string; eu: boolean; visivel: boolean; ganho: number; de?: number; para?: number; kg?: number; reps?: number; exercicios?: number }
export interface ExCarga { id: string; nome: string; grupo: string; pessoas: number }
export const rankingCarga = (exercicio?: string) => chatApi<{ exercicios: ExCarga[]; lista: LinhaCarga[]; semEquipe?: boolean }>({ acao: 'ranking_carga', exercicio });

export interface Post { id: string; autor: string; nome: string; foto: string; texto: string; imagem: string; em: number; curtidas: number; curti: boolean; meu: boolean; coach: boolean; tipo: string }
export const verFeed = (antes?: number) => chatApi<{ posts: Post[]; souCoach: boolean; mais: boolean }>({ acao: 'feed_ver', antes });
export const postar = (texto: string, imagem?: string, tipo?: 'treino') => chatApi<{ id: string }>({ acao: 'feed_postar', texto, imagem, tipo });
export const curtir = (id: string) => chatApi<{ curtidas: number; curti: boolean }>({ acao: 'feed_curtir', id });
export const apagarPost = (id: string) => chatApi({ acao: 'feed_apagar', id });
