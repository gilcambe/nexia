// Treino em andamento guardado no celular a cada série: se o aluno sair da tela, fechar o app,
// a bateria acabar ou a internet cair, ele continua de onde parou.
import type { Session, SetLog } from '@/mocks/workout';
import type { CardioAtividade } from './cardioDoTexto';
import type { Lesao } from './exerciseDb';
import type { Ficha } from './ficha';
import type { Extra } from './exercicioLivre';

export type Origem =
  | { tipo: 'ficha'; ficha: Ficha } // ficha automática do app: avança o ciclo ao salvar
  | { tipo: 'coach'; dia: number; dias: number } // ficha do coach: avança o dia ao salvar
  | { tipo: 'livre' }; // treino "só por hoje": não mexe em ficha nenhuma

export interface TreinoAndamento {
  v: 1;
  salvoEm: number;
  startedAt: string;
  phase: string;
  exIndex: number;
  session: Session;
  lesoes: Lesao[];
  setsByEx: Record<string, SetLog[]>;
  cardioFeito: CardioAtividade[];
  origem: Origem;
  extras?: Extra[]; // feito no intervalo (ex.: abdominal no descanso)
}

const chave = (uid: string) => `bc_treino_andamento_${uid}`;
const VALIDADE_MS = 16 * 3600000; // depois disso, é outro dia: não oferece continuar

export function lerAndamento(uid: string): TreinoAndamento | null {
  try {
    const t = JSON.parse(localStorage.getItem(chave(uid)) || 'null') as TreinoAndamento | null;
    if (!t || t.v !== 1 || !t.session || !Array.isArray(t.session.exercises)) return null;
    if (Date.now() - t.salvoEm > VALIDADE_MS || t.phase === 'SESSION_COMPLETE') { limparAndamento(uid); return null; }
    return t;
  } catch { return null; }
}

export function guardarAndamento(uid: string, t: Omit<TreinoAndamento, 'v' | 'salvoEm'>): void {
  try { localStorage.setItem(chave(uid), JSON.stringify({ ...t, v: 1, salvoEm: Date.now() })); } catch { /* sem armazenamento */ }
}

export function limparAndamento(uid: string): void {
  try { localStorage.removeItem(chave(uid)); } catch { /* sem armazenamento */ }
}

// Quantas séries já foram feitas (para o aviso "continuar treino").
export const seriesFeitas = (t: TreinoAndamento) => Object.values(t.setsByEx).reduce((a, l) => a + l.length, 0);
