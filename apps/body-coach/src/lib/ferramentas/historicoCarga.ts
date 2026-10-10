// Histórico de carga por exercício: usa o melhor set que cada treino salvo guardou (campo "melhores").
import { umRM } from './calculadoras';
import type { TreinoFeito } from './conquistas';

export interface PontoCarga { data: string; carga: number; reps: number; rm: number }
export interface ResumoExercicio {
  nome: string;
  sessoes: number;
  pontos: PontoCarga[]; // do mais antigo para o mais novo
  recorde: PontoCarga;
  ultimo: PontoCarga;
  variacaoPct: number; // 1RM estimado: primeira x última sessão
}

export function historicoPorExercicio(treinos: TreinoFeito[]): ResumoExercicio[] {
  const mapa = new Map<string, PontoCarga[]>();
  for (const t of treinos) {
    if (!t.done_at || !t.melhores) continue;
    for (const [nome, s] of Object.entries(t.melhores)) {
      const carga = Number(s?.weight) || 0;
      const reps = Number(s?.reps) || 0;
      if (!(carga > 0) || !(reps > 0)) continue;
      const l = mapa.get(nome) ?? [];
      l.push({ data: t.done_at, carga, reps, rm: umRM(carga, reps) });
      mapa.set(nome, l);
    }
  }
  const out: ResumoExercicio[] = [];
  for (const [nome, l] of mapa) {
    const pontos = l.sort((a, b) => a.data.localeCompare(b.data));
    const recorde = pontos.reduce((m, p) => (p.rm > m.rm ? p : m), pontos[0]);
    const ultimo = pontos[pontos.length - 1];
    const variacaoPct = pontos[0].rm > 0 ? Math.round(((ultimo.rm - pontos[0].rm) / pontos[0].rm) * 100) : 0;
    out.push({ nome, sessoes: pontos.length, pontos, recorde, ultimo, variacaoPct });
  }
  return out.sort((a, b) => b.sessoes - a.sessoes || a.nome.localeCompare(b.nome));
}

// Volume (kg levantados) por semana, das últimas N semanas.
export function volumeSemanal(treinos: TreinoFeito[], semanas = 8, agora = new Date()): { semana: string; kg: number; treinos: number }[] {
  const ini = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  ini.setDate(ini.getDate() - ((ini.getDay() + 6) % 7) - 7 * (semanas - 1));
  const out = Array.from({ length: semanas }, (_, i) => {
    const d = new Date(ini.getTime() + i * 7 * 86400000);
    return { semana: `${d.getDate()}/${d.getMonth() + 1}`, kg: 0, treinos: 0, t: d.getTime() };
  });
  for (const t of treinos) {
    if (!t.done_at) continue;
    const i = Math.floor((new Date(t.done_at).getTime() - ini.getTime()) / (7 * 86400000));
    if (i >= 0 && i < semanas) { out[i].kg += Number(t.volume_kg) || 0; out[i].treinos++; }
  }
  return out.map(({ semana, kg, treinos }) => ({ semana, kg: Math.round(kg), treinos }));
}
