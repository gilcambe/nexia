// "Estou sem tempo": encurta o treino do dia para ~20 minutos sem perder o principal.
// Fica com os 4 primeiros exercícios (a ficha começa pelos compostos), 2 séries cada, descanso curto
// e junta em bi-sets (1º com 2º, 3º com 4º). Puro.
import type { Session } from '@/mocks/workout';

export function encurtarTreino(s: Session, maxEx = 4): Session {
  if (s.title.endsWith('(expresso)')) return s;
  const exercises = s.exercises.slice(0, maxEx).map((e, i, l) => ({
    ...e,
    targetSets: Math.min(2, e.targetSets || 2),
    restSec: Math.min(60, e.restSec || 60),
    biset: i % 2 === 0 && i + 1 < l.length,
  }));
  return { ...s, title: `${s.title} (expresso)`, estimatedMinutes: Math.min(s.estimatedMinutes || 20, 20), exercises, warmup: s.warmup.slice(0, 1) };
}

export function minutosEstimados(s: Session): number {
  // cada série ~40 s + descanso (no bi-set o primeiro não descansa) + 1 min por exercício para arrumar o aparelho
  return Math.round(s.exercises.reduce((t, e) => t + 60 + (e.targetSets || 3) * (40 + (e.biset ? 0 : e.restSec || 60)), 0) / 60);
}

// Planilha (CSV) dos treinos: abre no Excel / Google Planilhas. Separador ";" (padrão do Excel no Brasil).
export function treinosEmCsv(lista: { done_at: string; title: string; duration_min?: number; sets?: number; volume_kg?: number; esforco?: number | null; comentario?: string | null; melhores?: Record<string, { weight: number; reps: number }> }[]): string {
  const cel = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const linhas = [['Data', 'Hora', 'Treino', 'Minutos', 'Séries', 'Volume (kg)', 'Esforço (1-5)', 'Comentário', 'Melhores séries'].map(cel).join(';')];
  for (const w of lista) {
    const d = new Date(w.done_at);
    linhas.push([
      d.toLocaleDateString('pt-BR'), d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), w.title, w.duration_min ?? '', w.sets ?? '',
      w.volume_kg ? String(w.volume_kg).replace('.', ',') : '', w.esforco ?? '', w.comentario ?? '',
      Object.entries(w.melhores ?? {}).map(([n, m]) => `${n} ${m.weight}kg x ${m.reps}`).join(' | '),
    ].map(cel).join(';'));
  }
  return '﻿' + linhas.join('\r\n');
}
