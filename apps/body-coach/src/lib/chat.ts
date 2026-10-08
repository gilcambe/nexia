// Conversa direta coach <-> aluno (WhatsApp interno). Passa pela API do app (login do Firebase), sem armazenamento pago.
import { getFirebase } from './firebaseClient';

const API_BASE: string = (import.meta.env.VITE_NEXIA_API_URL as string | undefined) || '';

export interface Contato { uid: string; nome: string; foto: string }
export interface Mensagem { id: string; de: string; texto: string; em: number }

export async function chatApi<T>(corpo: Record<string, unknown>): Promise<T> {
  const fb = await getFirebase();
  const token = await fb?.auth.currentUser?.getIdToken();
  if (!token) throw new Error('Entre na sua conta para conversar.');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${API_BASE}/api/body-coach-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(corpo),
      signal: ctrl.signal,
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) throw new Error(data.error || 'Não consegui conversar agora.');
    return data;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error('Demorou demais. Tente de novo.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
