// Exercícios da comunidade: quem cria um exercício novo salva para todos. Passa pela API do app.
import { chatApi } from './chat';

export interface ExercicioComunidade { id: string; nome: string; grupo: string; como: string; autor: string; autorNome?: string; em: number }
interface Resposta { lista: ExercicioComunidade[]; eu: string; item?: ExercicioComunidade | null }

export const GRUPOS_EX: { id: string; nome: string }[] = [
  { id: 'peito', nome: 'Peito' }, { id: 'costas', nome: 'Costas' }, { id: 'ombros', nome: 'Ombros' },
  { id: 'biceps', nome: 'Bíceps' }, { id: 'triceps', nome: 'Tríceps' }, { id: 'pernas', nome: 'Pernas' },
  { id: 'gluteos', nome: 'Glúteos' }, { id: 'panturrilha', nome: 'Panturrilha' }, { id: 'abdomen', nome: 'Abdômen' },
  { id: 'cardio', nome: 'Cardio' }, { id: 'corpo_todo', nome: 'Corpo todo' }, { id: 'outro', nome: 'Outro' },
];

// Guarda a lista por 5 min para não pedir de novo a cada tela.
let cache: { em: number; dados: Resposta } | null = null;

export async function listarExercicios(forcar = false): Promise<Resposta> {
  if (!forcar && cache && Date.now() - cache.em < 300000) return cache.dados;
  const dados = await chatApi<Resposta>({ acao: 'exercicios_listar' });
  cache = { em: Date.now(), dados: { lista: Array.isArray(dados.lista) ? dados.lista : [], eu: dados.eu } };
  return cache.dados;
}

export async function salvarExercicio(e: { id?: string; nome: string; grupo?: string; como?: string }): Promise<Resposta> {
  const dados = await chatApi<Resposta>({ acao: 'exercicios_salvar', ...e });
  cache = { em: Date.now(), dados };
  return dados;
}

export async function apagarExercicio(id: string): Promise<Resposta> {
  const dados = await chatApi<Resposta>({ acao: 'exercicios_apagar', id });
  cache = { em: Date.now(), dados };
  return dados;
}

// Busca na internet (grátis, sem chave): abre o YouTube já com "como fazer" + nome.
export const linkComoFazer = (nome: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`como fazer ${nome} exercício`)}`;
