// O lado do coach: painel dos alunos e a ficha/dieta que ele monta para cada um (tudo pela API do app).
import { chatApi } from '../chat';
import type { PlanoAlimentar } from '../planoAlimentar';
import type { FichaCoach } from './fichaCoach';
import type { AnamneseDoAluno, Situacao } from './equipe';

export interface LinhaAluno {
  uid: string; nome: string; foto: string;
  ultimoTreino: number | null; treinouHoje: boolean; diasSemTreinar: number | null; treinosSemana: number;
  refeicoesHoje: number; temFicha: boolean; temDieta: boolean; pago: boolean; avisou: boolean;
  anamnese: Situacao;
}
export interface Painel { alunos: LinhaAluno[]; hoje: string; mes: string; cobra: boolean }
export interface Prescricao { nome: string; foto: string; respostas: Record<string, unknown>; ficha: FichaCoach | null; fichaDia: number; plano: PlanoAlimentar | null; anamnese: AnamneseDoAluno | null }

export const painelAlunos = () => chatApi<Painel>({ acao: 'alunos_painel' });
export const prescricaoDo = (aluno: string) => chatApi<Prescricao>({ acao: 'prescricao_ver', com: aluno });
export const salvarFicha = (aluno: string, ficha: FichaCoach | null) =>
  chatApi<{ ok: true }>(ficha ? { acao: 'ficha_salvar', com: aluno, ficha } : { acao: 'ficha_salvar', com: aluno, remover: true });
export const salvarDieta = (aluno: string, plano: Pick<PlanoAlimentar, 'refeicoes' | 'totais' | 'extras'> | null) =>
  chatApi<{ ok: true }>(plano ? { acao: 'dieta_salvar', com: aluno, plano } : { acao: 'dieta_salvar', com: aluno, remover: true });

// Quem precisa de atenção: 3 dias ou mais sem treinar (ou nunca treinou).
export const sumiu = (a: LinhaAluno) => a.diasSemTreinar == null || a.diasSemTreinar >= 3;
