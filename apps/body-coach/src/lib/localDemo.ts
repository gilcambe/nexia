// Modo de demonstração LOCAL.
// Permite abrir o app e testar TODAS as telas sem depender do backend conectado.
// Login de teste: admin / admin01

export const LOCAL_DEMO_EMAIL = 'admin';
export const LOCAL_DEMO_PASSWORD = 'admin01';
export const LOCAL_DEMO_USER_ID = 'local-demo-user';

const LOCAL_DEMO_KEY = 'nexia_local_demo';
export const LOCAL_PROGRESS_KEY = 'nexia_local_progress';
export const LOCAL_EXAMS_KEY = 'nexia_local_exams';


export function isLocalDemoActive(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(LOCAL_DEMO_KEY) === '1';
  } catch {
    return false;
  }
}

export function enableLocalDemo(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_DEMO_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function disableLocalDemo(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LOCAL_DEMO_KEY);
  } catch {
    /* ignore */
  }
}

export function readLocalList<T>(key: string): T[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

export function writeLocalList<T>(key: string, value: T[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

// Registro de exame no modo local (nunca sai do navegador).
export interface LocalExamRecord {
  id?: number;
  exam_type: string | null;
  title: string;
  file_url?: string | null;
  notes: string | null;
  offset?: number;
  taken_at?: string;
}

// Data (YYYY-MM-DD) de N dias atrás.
export function localDateKey(daysAgo = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ISO de N dias atrás.
export function localIso(daysAgo = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}