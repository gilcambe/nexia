// Só o admin: ver o app como coach, aluno de coach ou quem treina sozinho (fica guardado no aparelho).
// Muda apenas as telas; o servidor continua conferindo cada pedido pela conta de verdade.
export type VerComo = 'coach' | 'aluno' | 'nenhum';
export const EMAIL_ADMIN = 'gcbezerra@gmail.com';

export function getVerComo(): VerComo {
  if (typeof window === 'undefined') return 'nenhum';
  const val = localStorage.getItem('nexia_body_coach_ver_como');
  if (val === 'coach' || val === 'aluno' || val === 'nenhum') {
    return val;
  }
  return 'nenhum';
}

export function setVerComo(modo: VerComo): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('nexia_body_coach_ver_como', modo);
}

export function podeVerComo(email?: string | null): boolean {
  if (!email) return false;
  return email.toLowerCase() === EMAIL_ADMIN.toLowerCase();
}
