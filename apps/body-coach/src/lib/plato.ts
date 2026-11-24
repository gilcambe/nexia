// Aviso de platô: exercício que não melhora há 3 treinos ou mais (e pelo menos 3 semanas).
// Usa a força estimada (1RM de Epley: carga × (1 + reps/30)) da melhor série de cada treino.

export interface TreinoComMelhores { done_at?: string; melhores?: Record<string, { weight: number; reps: number }> }
export interface Plato { exercicio: string; treinos: number; semanas: number; melhor: { weight: number; reps: number }; dica: string }

export const forca = (m: { weight: number; reps: number }) => (m.weight > 0 ? m.weight * (1 + Math.min(m.reps, 20) / 30) : m.reps);

const DICAS = [
  'Mude a faixa de repetições por 3 semanas (ex.: de 8-12 para 5-8, com mais carga).',
  'Na última série, faça um drop-set: tire 20% da carga e vá até quase a falha.',
  'Troque por uma variação parecida por 3 semanas (ex.: halter no lugar da barra) e depois volte.',
  'Confira sono, proteína e calorias: sem recuperação a força não sobe.',
];

export function acharPlatos(treinos: TreinoComMelhores[], agora = Date.now()): Plato[] {
  const porEx: Record<string, { em: number; m: { weight: number; reps: number } }[]> = {};
  for (const t of treinos) {
    const em = t.done_at ? Date.parse(t.done_at) : NaN;
    if (!Number.isFinite(em) || em < agora - 120 * 86400000) continue; // só os últimos 4 meses
    for (const [nome, m] of Object.entries(t.melhores ?? {})) {
      if (!m || !(Number(m.reps) > 0)) continue;
      (porEx[nome] ??= []).push({ em, m: { weight: Number(m.weight) || 0, reps: Number(m.reps) } });
    }
  }
  const out: Plato[] = [];
  for (const [nome, lista] of Object.entries(porEx)) {
    lista.sort((a, b) => a.em - b.em);
    if (lista.length < 4) continue;
    // Recorde até agora e quando foi batido.
    let recorde = -1; let quando = 0; let melhor = lista[0].m;
    for (const x of lista) { const f = forca(x.m); if (f > recorde * 1.01) { recorde = f; quando = x.em; melhor = x.m; } }
    const depois = lista.filter((x) => x.em > quando);
    const semanas = Math.floor((agora - quando) / (7 * 86400000));
    if (depois.length >= 3 && semanas >= 3 && lista[lista.length - 1].em > agora - 21 * 86400000) {
      out.push({ exercicio: nome, treinos: depois.length, semanas, melhor, dica: DICAS[out.length % DICAS.length] });
    }
  }
  return out.sort((a, b) => b.semanas - a.semanas).slice(0, 5);
}
