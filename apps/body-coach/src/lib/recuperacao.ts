import { Grupo } from './exerciseDb';

export const GRUPOS_RECUPE: { id: Grupo; rotulo: string; grande: boolean }[] = [
  { id: 'peito', rotulo: 'Peito', grande: true },
  { id: 'costas', rotulo: 'Costas', grande: true },
  { id: 'ombros', rotulo: 'Ombros', grande: false },
  { id: 'biceps', rotulo: 'Bíceps', grande: false },
  { id: 'triceps', rotulo: 'Tríceps', grande: false },
  { id: 'quadriceps', rotulo: 'Quadríceps', grande: true },
  { id: 'posterior', rotulo: 'Posterior', grande: true },
  { id: 'gluteos', rotulo: 'Glúteos', grande: true },
  { id: 'panturrilha', rotulo: 'Panturrilha', grande: false },
  { id: 'abdomen', rotulo: 'Abdômen', grande: false },
];

export interface TreinoParaRecuperacao {
  done_at?: string;
  created_at?: string;
  series_por_grupo?: Record<string, number>;
  melhores?: Record<string, unknown>;
  exercises?: { id?: string; name?: string; sets?: unknown[] }[];
}

// Extrai a contagem de séries por grupo muscular de um treino
export function extrairSeriesPorGrupo(t: TreinoParaRecuperacao): Record<string, number> {
  const res: Record<string, number> = {};
  if (t.series_por_grupo && typeof t.series_por_grupo === 'object') {
    for (const [k, v] of Object.entries(t.series_por_grupo)) {
      if (typeof v === 'number' && v > 0) res[k] = (res[k] ?? 0) + v;
    }
  }
  return res;
}

// Calcula o percentual de recuperação (0 a 100) para cada grupo muscular
// 100 = totalmente descansado. Cada série desgasta ~8 pontos.
// Grupos pequenos recuperam ~2.2%/h, grupos grandes recuperam ~1.75%/h (mais devagar).
export function calcularRecuperacao(
  workouts: TreinoParaRecuperacao[],
  agora = new Date()
): Record<Grupo, number> {
  const agoraMs = agora.getTime();
  const desgaste: Record<string, number> = {};

  for (const g of GRUPOS_RECUPE) {
    desgaste[g.id] = 0;
  }

  for (const t of workouts) {
    const dataStr = t.done_at || t.created_at;
    if (!dataStr) continue;
    const dataTreino = new Date(dataStr);
    if (isNaN(dataTreino.getTime())) continue;

    const horasPassadas = (agoraMs - dataTreino.getTime()) / (1000 * 60 * 60);
    if (horasPassadas < 0 || horasPassadas > 96) continue; // Mais de 4 dias já recuperou totalmente

    const seriesMap = extrairSeriesPorGrupo(t);

    for (const g of GRUPOS_RECUPE) {
      const numSeries = seriesMap[g.id] || 0;
      if (numSeries <= 0) continue;

      const pontosDesgaste = numSeries * 8; // Cada série tira ~8% de descansado
      const taxaRecuperacaoHora = g.grande ? 1.75 : 2.25; // % por hora (~2%/h, grandes mais devagar)
      const recuperado = horasPassadas * taxaRecuperacaoHora;

      const desgasteRestante = Math.max(0, pontosDesgaste - recuperado);
      desgaste[g.id] += desgasteRestante;
    }
  }

  const resultado = {} as Record<Grupo, number>;
  for (const g of GRUPOS_RECUPE) {
    const d = desgaste[g.id] || 0;
    resultado[g.id] = Math.max(0, Math.min(100, Math.round(100 - d)));
  }

  return resultado;
}

export function statusRecuperacao(porcentagem: number): {
  estado: 'descansado' | 'moderado' | 'fatigado';
  corBg: string;
  corTexto: string;
} {
  if (porcentagem >= 80) {
    return { estado: 'descansado', corBg: 'bg-emerald-500', corTexto: 'text-emerald-500' };
  }
  if (porcentagem >= 50) {
    return { estado: 'moderado', corBg: 'bg-amber-500', corTexto: 'text-amber-500' };
  }
  return { estado: 'fatigado', corBg: 'bg-rose-500', corTexto: 'text-rose-500' };
}
