// Modo escuro: escolha de cada pessoa, guardada no celular. "auto" segue o celular.
export type Tema = 'claro' | 'escuro' | 'auto';
export const TEMAS: { id: Tema; nome: string; icone: string }[] = [
  { id: 'claro', nome: 'Claro', icone: 'ri-sun-line' },
  { id: 'escuro', nome: 'Escuro', icone: 'ri-moon-line' },
  { id: 'auto', nome: 'Igual ao celular', icone: 'ri-smartphone-line' },
];
const CHAVE = 'bc_tema';

export function temaGuardado(): Tema {
  try { const v = localStorage.getItem(CHAVE); return TEMAS.some((t) => t.id === v) ? (v as Tema) : 'claro'; } catch { return 'claro'; }
}

export function escuroAgora(t: Tema = temaGuardado()): boolean {
  if (t === 'escuro') return true;
  if (t === 'auto') { try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch { return false; } }
  return false;
}

let ouvindo = false;
export function aplicarTema(t: Tema = temaGuardado()): void {
  const escuro = escuroAgora(t);
  document.documentElement.classList.toggle('dark', escuro);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', escuro ? '#1b1a17' : '#fbfbf7');
  if (!ouvindo) {
    ouvindo = true;
    try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (temaGuardado() === 'auto') aplicarTema('auto'); }); } catch { /* navegador antigo */ }
  }
}

export function definirTema(t: Tema): void {
  try { localStorage.setItem(CHAVE, t); } catch { /* sem armazenamento */ }
  aplicarTema(t);
}
