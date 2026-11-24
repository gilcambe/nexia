// Teste físico do mês: 5 testes simples, sem aparelho. Guardado no perfil; dá para editar e apagar.

export interface ItemTeste { id: string; nome: string; unidade: string; como: string; menorMelhor?: boolean; cronometro?: number }
export const ITENS_TESTE: ItemTeste[] = [
  { id: 'flexoes', nome: 'Flexões em 1 minuto', unidade: 'reps', como: 'Peito perto do chão, corpo reto. Pode apoiar os joelhos (faça sempre do mesmo jeito).', cronometro: 60 },
  { id: 'agachamentos', nome: 'Agachamentos em 1 minuto', unidade: 'reps', como: 'Coxa paralela ao chão, sem peso.', cronometro: 60 },
  { id: 'abdominais', nome: 'Abdominais em 1 minuto', unidade: 'reps', como: 'Crunch: ombros saem do chão, mãos no peito.', cronometro: 60 },
  { id: 'prancha', nome: 'Prancha (tempo máximo)', unidade: 's', como: 'Cotovelos no chão, corpo reto. Pare quando o quadril cair.' },
  { id: 'corrida', nome: 'Correr ou caminhar 1 km', unidade: 's', como: 'O mais rápido que conseguir. Opcional.', menorMelhor: true },
];

export interface ResultadoTeste { id: string; em: string; valores: Record<string, number> }

export function compararTeste(atual: ResultadoTeste, anterior?: ResultadoTeste): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const it of ITENS_TESTE) {
    const a = atual.valores[it.id]; const b = anterior?.valores[it.id];
    out[it.id] = a > 0 && b > 0 ? (it.menorMelhor ? b - a : a - b) : null;
  }
  return out;
}

export const diasDesde = (iso?: string, agora = Date.now()) => (iso ? Math.floor((agora - Date.parse(iso)) / 86400000) : null);

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
export function lerTempo(t: string): number {
  const m = /^(\d+):(\d{1,2})$/.exec(t.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : Number(t.replace(',', '.')) || 0;
}
