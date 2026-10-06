import { getFirebase } from './firebase';

export type Papel = 'coach' | 'nutrologo' | 'personal' | 'fisioterapeuta';

export async function perguntar(papel: Papel, message: string, context: Record<string, unknown>): Promise<string> {
  const fb = await getFirebase();
  const token = await fb?.auth.currentUser?.getIdToken();

  const response = await fetch('/api/coach/perguntar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ papel, message, context })
  });

  if (!response.ok) {
    throw new Error(`Erro ao perguntar à IA (${response.status})`);
  }

  const data = await response.json();
  return data.answer || data.resposta || '';
}
