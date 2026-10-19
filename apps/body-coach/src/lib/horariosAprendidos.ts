// Lembretes inteligentes: os horários saem do uso (quando a pessoa costuma treinar e comer), sem servidor e sem custo.
export interface Aprendido { treino: string | null; refeicoes: string[]; agua: { de: string; ate: string } | null }

const DIA = 86400000;
const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;
const paraMin = (h: string) => { const m = h.match(HORA); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
const paraHora = (min: number) => { const t = Math.max(0, Math.min(23 * 60 + 55, Math.round(min / 5) * 5)); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
const mediana = (l: number[]) => { const o = [...l].sort((a, b) => a - b); const k = Math.floor(o.length / 2); return o.length % 2 ? o[k] : (o[k - 1] + o[k]) / 2; };

// Agrupa horários próximos (até 90 min) e devolve a mediana de cada grupo com pelo menos `min` registros.
export function gruposDeHorario(minutos: number[], min = 3): number[] {
  const o = minutos.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  const grupos: number[][] = [];
  for (const n of o) {
    const g = grupos[grupos.length - 1];
    if (g && n - g[g.length - 1] <= 90) g.push(n); else grupos.push([n]);
  }
  return grupos.filter((g) => g.length >= min).map(mediana);
}

// refeicoes: { time "HH:MM", created_at ISO }; treinos: done_at ISO. Só os últimos 30 dias contam.
export function aprenderHorarios(refeicoes: { time?: string; created_at?: string }[], treinos: string[], agora = new Date()): Aprendido {
  const limite = agora.getTime() - 30 * DIA;
  const recente = (iso?: string) => !iso || new Date(iso).getTime() >= limite;
  const minRef = refeicoes.filter((r) => recente(r.created_at)).map((r) => paraMin(r.time ?? ''));
  const minTreino = treinos.filter((t) => recente(t)).map((t) => { const d = new Date(t); return d.getHours() * 60 + d.getMinutes(); }).filter((n) => Number.isFinite(n));
  // treino: avisa 30 min antes do horário de sempre (o done_at é o fim do treino, que dura ~1 h)
  const treino = minTreino.length >= 3 ? paraHora(mediana(minTreino) - 90) : null;
  const refeicoesTipicas = gruposDeHorario(minRef).slice(0, 4).map(paraHora);
  const todos = [...minRef.filter(Number.isFinite), ...minTreino];
  const agua = todos.length >= 5 ? { de: paraHora(Math.min(...todos)), ate: paraHora(Math.max(...todos)) } : null;
  return { treino, refeicoes: refeicoesTipicas, agua: agua && paraMin(agua.ate) - paraMin(agua.de) >= 120 ? agua : null };
}

// Junta o que foi aprendido às preferências atuais (só troca o que tem dado suficiente).
export function aplicarAprendido<P extends { treino: { ativo: boolean; hora: string }; agua: { ativo: boolean; de: string; ate: string; cada: number }; refeicao?: { ativo: boolean; horas: string[] } }>(prefs: P, a: Aprendido): P {
  return {
    ...prefs,
    treino: a.treino ? { ...prefs.treino, hora: a.treino } : prefs.treino,
    agua: a.agua ? { ...prefs.agua, ...a.agua } : prefs.agua,
    refeicao: a.refeicoes.length ? { ativo: prefs.refeicao?.ativo ?? false, horas: a.refeicoes } : prefs.refeicao,
  };
}
