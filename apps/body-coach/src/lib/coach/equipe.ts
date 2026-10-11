// Anamnese do coach (perguntas dele, respostas do aluno) e modelos de ficha/dieta para aplicar em vários alunos.
import { chatApi } from '../chat';
import type { PlanoAlimentar } from '../planoAlimentar';
import type { FichaCoach } from './fichaCoach';

export type TipoPergunta = 'texto' | 'simnao' | 'opcoes' | 'numero';
export interface Pergunta { id: string; texto: string; tipo: TipoPergunta; opcoes: string[]; obrigatoria: boolean }
export interface Anamnese { versao: number; titulo: string; perguntas: Pergunta[] }
export type Situacao = 'pendente' | 'respondida' | null;
export interface AnamneseDoAluno { perguntas: Pergunta[]; respostas: Record<string, string>; em: number | null; situacao: Situacao }

export const anamneseDoCoach = () => chatApi<{ anamnese: Anamnese | null }>({ acao: 'anamnese_ver' }).then((r) => r.anamnese);
export const salvarAnamnese = (titulo: string, perguntas: Pergunta[]) => chatApi<{ anamnese: Anamnese | null }>({ acao: 'anamnese_salvar', titulo, perguntas });
export const minhaAnamnese = () => chatApi<{ anamnese: Anamnese | null; coach?: string; respostas?: Record<string, string>; situacao: Situacao }>({ acao: 'anamnese_ver' });
export const responderAnamnese = (respostas: Record<string, string>) => chatApi<{ ok: true }>({ acao: 'anamnese_responder', respostas });

let n = 0;
const p = (texto: string, tipo: TipoPergunta = 'texto', opcoes: string[] = [], obrigatoria = false): Pergunta => ({ id: `q${Date.now().toString(36)}${n++}`, texto, tipo, opcoes, obrigatoria });

// Perguntas prontas (triagem de saúde PAR-Q + rotina + alimentação), para o coach não começar do zero.
export const PERGUNTAS_PRONTAS = (): Pergunta[] => [
  p('Algum médico já disse que você tem problema de coração ou pressão alta?', 'simnao', [], true),
  p('Sente dor no peito, tontura ou falta de ar fazendo esforço?', 'simnao', [], true),
  p('Tem alguma lesão, dor nas articulações ou cirurgia recente? Qual?', 'texto'),
  p('Toma algum remédio de uso contínuo? Qual?', 'texto'),
  p('Qual o seu objetivo principal?', 'opcoes', ['Emagrecer', 'Ganhar massa', 'Condicionamento', 'Saúde e qualidade de vida', 'Performance no esporte'], true),
  p('Há quanto tempo treina?', 'opcoes', ['Nunca treinei', 'Menos de 6 meses', '6 meses a 2 anos', 'Mais de 2 anos']),
  p('Quantos dias por semana consegue treinar?', 'numero'),
  p('Qual o melhor horário para treinar?', 'opcoes', ['Manhã', 'Tarde', 'Noite']),
  p('Quantas horas dorme por noite, em média?', 'numero'),
  p('Tem alguma restrição ou alergia alimentar?', 'texto'),
  p('Fuma ou bebe com frequência?', 'texto'),
  p('O que mais te atrapalhou para ter resultado até hoje?', 'texto'),
];
export const novaPergunta = () => p('');

export interface ModeloResumo { id: string; tipo: 'ficha' | 'dieta'; nome: string; resumo: string; em: number; usos: number }
type Plano = Pick<PlanoAlimentar, 'refeicoes' | 'totais' | 'extras'>;
export const listarModelos = (tipo?: 'ficha' | 'dieta') => chatApi<{ modelos: ModeloResumo[] }>({ acao: 'modelo_listar', tipo }).then((r) => r.modelos);
export const verModelo = (id: string) => chatApi<{ modelo: { id: string; tipo: 'ficha' | 'dieta'; nome: string; dados: FichaCoach | Plano } }>({ acao: 'modelo_ver', id }).then((r) => r.modelo);
export const salvarModelo = (tipo: 'ficha' | 'dieta', nome: string, dados: FichaCoach | Plano, id?: string) => chatApi<{ id: string; nome: string }>({ acao: 'modelo_salvar', tipo, nome, dados, id });
export const apagarModelo = (id: string) => chatApi<{ ok: true }>({ acao: 'modelo_apagar', id });
export const aplicarModelo = (id: string, alunos: string[]) => chatApi<{ aplicados: number; recusados: number }>({ acao: 'modelo_aplicar', id, alunos });
