// Evolução entre coach e aluno pela API do app (o servidor confere o vínculo; as regras do banco não mudam).
import { chatApi, type Mensagem } from '@/lib/chat';
import type { ProgressEntry } from '@/hooks/useProgressData';
import type { PerfilAvaliacao, Pose } from './dados.ts';

const API_BASE: string = (import.meta.env.VITE_NEXIA_API_URL as string | undefined) || '';

export interface Partilha { avaliacoes: boolean; fotos: boolean }
export interface ProximaAvaliacao { data: string; hora: string | null; em: number }
export interface PerfilServidor extends PerfilAvaliacao { metaGordura: number | null; metaPeso: number | null }
type EntradaServidor = Omit<ProgressEntry, 'signedUrl'> & { poses?: Pose[] };

export interface AlunoResumo {
  uid: string;
  nome: string;
  foto: string;
  partilha: Partilha;
  proximaAvaliacao: ProximaAvaliacao | null;
  entradas: ProgressEntry[];
  perfil: PerfilServidor | null;
}

export interface Comentario extends Mensagem { ref?: { entrada: string; alvo: string; data: string | null } }

// O servidor devolve os documentos como estão no banco; aqui viram o mesmo formato que o app usa.
export function paraEntradas(lista: EntradaServidor[]): ProgressEntry[] {
  return lista
    .map((e) => ({ ...e, measurements: e.measurements ?? {}, signedUrl: e.fotos?.frente || e.image_url || null }))
    .sort((a, b) => new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime());
}

export async function alunosEvolucao(): Promise<AlunoResumo[]> {
  const r = await chatApi<{ alunos: (Omit<AlunoResumo, 'entradas'> & { entradas: EntradaServidor[] })[] }>({ acao: 'alunos_evolucao' });
  return r.alunos.map((a) => ({ ...a, entradas: paraEntradas(a.entradas) }));
}

export async function alunoEvolucao(uid: string) {
  const r = await chatApi<{ entradas: EntradaServidor[]; perfil: PerfilServidor; partilha: Partilha; nome: string; proximaAvaliacao: ProximaAvaliacao | null }>({ acao: 'aluno_evolucao', com: uid });
  return { ...r, entradas: paraEntradas(r.entradas) };
}

export const agendarAvaliacao = (uid: string, data: string | null, hora?: string) =>
  chatApi<{ proximaAvaliacao: ProximaAvaliacao | null }>({ acao: 'agendar_avaliacao', com: uid, data, hora });

export const evolucaoInfo = () =>
  chatApi<{ coach: { uid: string; nome: string; foto: string } | null; partilha: Partilha; proximaAvaliacao: ProximaAvaliacao | null }>({ acao: 'evolucao_info' });

export const evolucaoConfig = (p: Partilha) => chatApi<{ partilha: Partilha }>({ acao: 'evolucao_config', ...p });

export async function comentarios(com: string, entrada: string | number): Promise<Comentario[]> {
  const r = await chatApi<{ mensagens: Comentario[] }>({ acao: 'ler', com });
  return r.mensagens.filter((m) => m.ref?.entrada === String(entrada));
}

export const comentar = (com: string, entrada: string | number, alvo: string, texto: string, data?: string) =>
  chatApi<{ mensagem: Comentario }>({ acao: 'comentar', com, entrada: String(entrada), alvo, texto, data });

export const criarLink = (entrada: string | number, dias: number, fotos: boolean) =>
  chatApi<{ token: string; expira: number }>({ acao: 'compartilhar_criar', entrada: String(entrada), dias, fotos });

export const revogarLink = (token: string) => chatApi<{ ok: true }>({ acao: 'compartilhar_revogar', token });

// Link público: sem login.
export async function verCompartilhado(token: string) {
  const res = await fetch(`${API_BASE}/api/body-coach-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acao: 'compartilhado_ver', token }),
  });
  const data = (await res.json().catch(() => ({}))) as { entradas?: EntradaServidor[]; perfil?: PerfilServidor; expira?: number; error?: string };
  if (!res.ok || !data.entradas || !data.perfil) throw new Error(data.error || 'Não consegui abrir o link.');
  return { entradas: paraEntradas(data.entradas), perfil: data.perfil, expira: data.expira ?? 0 };
}

export const ALVOS: { id: string; label: string }[] = [
  { id: 'geral', label: 'Geral' },
  { id: 'medidas', label: 'Medidas' },
  { id: 'frente', label: 'Foto de frente' },
  { id: 'costas', label: 'Foto de costas' },
  { id: 'direita', label: 'Foto lado direito' },
  { id: 'esquerda', label: 'Foto lado esquerdo' },
];

export const PREPARO = [
  'Jejum de 3 horas e sem café antes.',
  'Não treine nas 12 horas anteriores.',
  'Bexiga vazia e boa hidratação no dia anterior.',
  'Roupa leve; para as fotos, mesma roupa, luz e lugar da última vez.',
];
