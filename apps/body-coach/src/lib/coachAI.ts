// Equipe de IA do aluno (coach, nutrólogo, personal, fisioterapeuta): fala com /api/body-coach-ai,
// que exige o login do Firebase e usa só modelos grátis.
import { getFirebase } from './firebaseClient';

export type Papel = 'coach' | 'nutrologo' | 'personal' | 'fisioterapeuta';

const API_BASE: string = (import.meta.env.VITE_NEXIA_API_URL as string | undefined) || '';

export async function perguntar(papel: Papel, message: string, context: Record<string, unknown>, image?: string): Promise<string> {
  const fb = await getFirebase();
  const token = await fb?.auth.currentUser?.getIdToken();
  if (!token) throw new Error('Entre na sua conta para falar com a equipe.');
  const res = await fetch(`${API_BASE}/api/body-coach-ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message, role: papel, context, ...(image ? { image } : {}) }),
  });
  const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
  if (!res.ok) throw new Error(data.error || 'Não consegui falar com a equipe agora.');
  return data.reply ?? '';
}
