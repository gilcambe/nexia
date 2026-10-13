// Só o admin: ver o app como coach, aluno de coach ou quem treina sozinho (fica guardado no aparelho).
// Muda apenas as telas; o servidor continua conferindo cada pedido pela conta de verdade.
export type VerComo = 'coach' | 'aluno' | 'nenhum';
export const EMAIL_ADMIN = 'gcbezerra@gmail.com';

export function verComo(): VerComo | null {
  try { const v = localStorage.getItem('bc_ver_como'); return v === 'coach' || v === 'aluno' || v === 'nenhum' ? v : null; } catch { return null; }
}

export function mudarVerComo(v: VerComo | null) {
  try { if (v) localStorage.setItem('bc_ver_como', v); else localStorage.removeItem('bc_ver_como'); } catch { /* sem armazenamento */ }
  window.dispatchEvent(new Event('bc-ver-como'));
}
