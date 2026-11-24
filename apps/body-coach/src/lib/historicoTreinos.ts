// Histórico de treinos feitos: junta o banco com a cópia do celular, monta o calendário do mês
// e permite apagar ou corrigir um treino (tudo que o aluno lança pode ser apagado).

export interface TreinoFeito {
  id: string;
  title: string;
  done_at: string;
  duration_min?: number;
  sets?: number;
  volume_kg?: number;
  kcal?: number;
  esforco?: number | null;
  comentario?: string | null;
  melhores?: Record<string, { weight: number; reps: number }>;
  _docId?: string;
}

const chave = (uid: string) => `bc_workouts_${uid}`;

export function lerLocais(uid: string): TreinoFeito[] {
  try {
    const l = JSON.parse(localStorage.getItem(chave(uid)) || '[]');
    return Array.isArray(l) ? l.filter((w) => w && typeof w.done_at === 'string') : [];
  } catch { return []; }
}

function gravarLocais(uid: string, lista: TreinoFeito[]) {
  try { localStorage.setItem(chave(uid), JSON.stringify(lista)); } catch { /* sem armazenamento */ }
}

const mesmo = (a: TreinoFeito, b: TreinoFeito) => (a.id && b.id && a.id === b.id) || (a.done_at === b.done_at && a.title === b.title);

// Banco primeiro (tem o id do documento); do celular entra só o que o banco não tem. Mais novo primeiro.
export function juntar(doBanco: TreinoFeito[], doCelular: TreinoFeito[]): TreinoFeito[] {
  const out = doBanco.map((w) => ({ ...w, id: w.id || w._docId || w.done_at }));
  for (const l of doCelular) if (!out.some((w) => mesmo(w, l))) out.push({ ...l, id: l.id || l.done_at });
  return out.sort((a, b) => b.done_at.localeCompare(a.done_at));
}

export const diaLocal = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Grade do mês (semana começa na segunda): null nas casas vazias.
export function gradeDoMes(ano: number, mes: number): (string | null)[] {
  const primeiro = new Date(ano, mes, 1);
  const vazias = (primeiro.getDay() + 6) % 7;
  const dias = new Date(ano, mes + 1, 0).getDate();
  const out: (string | null)[] = Array(vazias).fill(null);
  for (let d = 1; d <= dias; d++) out.push(`${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  while (out.length % 7) out.push(null);
  return out;
}

export function porDia(lista: TreinoFeito[]): Record<string, TreinoFeito[]> {
  const m: Record<string, TreinoFeito[]> = {};
  for (const w of lista) (m[diaLocal(w.done_at)] ??= []).push(w);
  return m;
}

export function tirarDoCelular(uid: string, w: TreinoFeito) {
  gravarLocais(uid, lerLocais(uid).filter((l) => !mesmo(l, w)));
}

export function corrigirNoCelular(uid: string, w: TreinoFeito, mudancas: Partial<TreinoFeito>) {
  gravarLocais(uid, lerLocais(uid).map((l) => (mesmo(l, w) ? { ...l, ...mudancas } : l)));
}
