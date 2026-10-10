// Retrospectiva do mês: números do mês para o aluno ver e postar.
import { sequencias, type TreinoFeito } from './conquistas';

export interface Retro {
  treinos: number; horas: number; kg: number; km: number; kcal: number; recordes: string[];
  maiorSequencia: number; diaFavorito: string | null; exercicioTop: string | null; comparacao: number | null;
}
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export function retrospectiva(treinos: TreinoFeito[], ano: number, mes: number): Retro {
  const noMes = (t: TreinoFeito, a: number, m: number) => { const d = new Date(t.done_at ?? ''); return d.getFullYear() === a && d.getMonth() === m; };
  const lista = treinos.filter((t) => t.done_at && noMes(t, ano, mes));
  const antes = treinos.filter((t) => t.done_at && new Date(t.done_at) < new Date(ano, mes, 1));
  const ant = mes === 0 ? [ano - 1, 11] : [ano, mes - 1];
  const doAnterior = treinos.filter((t) => t.done_at && noMes(t, ant[0], ant[1])).length;
  const melhorAntes = new Map<string, number>();
  for (const t of antes) for (const [n, s] of Object.entries(t.melhores ?? {})) melhorAntes.set(n, Math.max(melhorAntes.get(n) ?? 0, Number(s.weight) || 0));
  const recordes = new Map<string, number>();
  const contagem = new Map<string, number>();
  const porDia = new Array(7).fill(0);
  for (const t of lista) {
    porDia[new Date(t.done_at as string).getDay()]++;
    for (const [n, s] of Object.entries(t.melhores ?? {})) {
      contagem.set(n, (contagem.get(n) ?? 0) + 1);
      const w = Number(s.weight) || 0;
      if (melhorAntes.has(n) && w > (melhorAntes.get(n) ?? 0) && w > (recordes.get(n) ?? 0)) recordes.set(n, w);
    }
  }
  const top = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0];
  const fav = porDia.indexOf(Math.max(...porDia));
  const t2 = lista as (TreinoFeito & { kcal?: number })[];
  return {
    treinos: lista.length,
    horas: Math.round((lista.reduce((s, t) => s + (Number(t.duration_min) || 0), 0) / 60) * 10) / 10,
    kg: Math.round(lista.reduce((s, t) => s + (Number(t.volume_kg) || 0), 0)),
    km: Math.round(lista.reduce((s, t) => s + (t.cardio ?? []).reduce((a, c) => a + (Number(c.km) || 0), 0), 0) * 10) / 10,
    // Treinos antigos não guardavam calorias: estima ~6 kcal por minuto (musculação moderada, ~70 kg).
    kcal: Math.round(t2.reduce((s, t) => s + (Number(t.kcal) || (Number(t.duration_min) || 0) * 6), 0)),
    recordes: [...recordes.entries()].map(([n, w]) => `${n}: ${w} kg`),
    maiorSequencia: sequencias(lista.map((t) => new Date(t.done_at as string)), new Date(ano, mes + 1, 0)).maior,
    diaFavorito: lista.length ? DIAS[fav] : null,
    exercicioTop: top?.[0] ?? null,
    comparacao: doAnterior ? Math.round(((lista.length - doAnterior) / doAnterior) * 100) : null,
  };
}
