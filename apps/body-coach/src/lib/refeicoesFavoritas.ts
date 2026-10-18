// Refeições favoritas: guarda no aparelho as refeições que a pessoa repete, para registrar de novo em 1 toque.
export interface Favorita { name: string; calories: number; protein: number; carbs: number; fat: number; fiber: number }

const CHAVE = 'bc_refeicoes_favoritas';
const MAX = 12;

export const lerFavoritas = (): Favorita[] => {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? '[]');
    return Array.isArray(v) ? v.filter((f) => f && typeof f.name === 'string').slice(0, MAX) : [];
  } catch { return []; }
};

const gravar = (l: Favorita[]) => { try { localStorage.setItem(CHAVE, JSON.stringify(l.slice(0, MAX))); } catch { /* sem armazenamento */ } };

export const ehFavorita = (l: Favorita[], nome: string) => l.some((f) => f.name.toLowerCase() === nome.toLowerCase());

// Liga/desliga a estrela: a mais recente fica no topo e a lista nunca passa de 12.
export function alternarFavorita(l: Favorita[], f: Favorita): Favorita[] {
  const novo = ehFavorita(l, f.name) ? l.filter((x) => x.name.toLowerCase() !== f.name.toLowerCase()) : [f, ...l].slice(0, MAX);
  gravar(novo);
  return novo;
}
