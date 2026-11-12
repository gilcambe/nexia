// Só o admin: ver o app como coach, aluno de coach ou quem treina sozinho (fica guardado no aparelho).
// Muda apenas as telas; o servidor continua conferindo cada pedido pela conta de verdade.
export type VerComo = 'coach' | 'aluno' | 'nenhum';
// G2 (12/11): quem é o dono vem do servidor (verAcesso().master), não de um e-mail escrito no código público.
// Guardado no aparelho para o menu aparecer na hora; o servidor continua conferindo cada pedido.
const CHAVE_DONO = 'bc_eh_dono';
export function ehDonoGuardado(): boolean {
  try { return localStorage.getItem(CHAVE_DONO) === '1'; } catch { return false; }
}
export function guardarEhDono(v: boolean) {
  try { if (v) localStorage.setItem(CHAVE_DONO, '1'); else localStorage.removeItem(CHAVE_DONO); } catch { /* sem armazenamento */ }
  window.dispatchEvent(new Event('bc-eh-dono'));
}

export function verComo(): VerComo | null {
  try { const v = localStorage.getItem('bc_ver_como'); return v === 'coach' || v === 'aluno' || v === 'nenhum' ? v : null; } catch { return null; }
}

export function mudarVerComo(v: VerComo | null) {
  try { if (v) localStorage.setItem('bc_ver_como', v); else localStorage.removeItem('bc_ver_como'); } catch { /* sem armazenamento */ }
  window.dispatchEvent(new Event('bc-ver-como'));
}
