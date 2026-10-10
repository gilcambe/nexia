import { useEffect, useState } from 'react';
import { listUserDocs } from '@/lib/userData';
import type { TreinoFeito } from './conquistas';

export interface Historico {
  carregando: boolean;
  treinos: TreinoFeito[];
  refeicoes: number;
  checkins: number;
  avaliacoes: number;
}

// Treinos (do aparelho + da nuvem, sem repetir) e contagens de refeições, check-ins e avaliações.
export async function carregarTreinos(uid: string): Promise<TreinoFeito[]> {
  const porData = new Map<string, TreinoFeito>();
  try {
    const raw = JSON.parse(localStorage.getItem('bc_workouts_' + uid) || '[]');
    if (Array.isArray(raw)) for (const w of raw) if (w?.done_at) porData.set(w.done_at, w);
  } catch { /* sem dados locais */ }
  try {
    for (const w of await listUserDocs<TreinoFeito>(uid, 'workouts', 'done_at', 'desc')) if (w.done_at) porData.set(w.done_at, w);
  } catch { /* offline */ }
  return [...porData.values()];
}

export function useHistorico(uid: string | undefined, comAvaliacoes = true): Historico {
  const [h, setH] = useState<Historico>({ carregando: true, treinos: [], refeicoes: 0, checkins: 0, avaliacoes: 0 });
  useEffect(() => {
    if (!uid) return;
    let vivo = true;
    void (async () => {
      const [treinos, refeicoes, checkins, avaliacoes] = await Promise.all([
        carregarTreinos(uid),
        listUserDocs(uid, 'meals', 'created_at', 'desc').then((l) => l.length).catch(() => 0),
        listUserDocs(uid, 'daily_readiness', 'check_in_date', 'desc').then((l) => l.length).catch(() => 0),
        comAvaliacoes ? listUserDocs(uid, 'progress_entries', 'taken_at', 'asc').then((l) => l.length).catch(() => 0) : Promise.resolve(0),
      ]);
      if (vivo) setH({ carregando: false, treinos, refeicoes, checkins, avaliacoes });
    })();
    return () => { vivo = false; };
  }, [uid, comAvaliacoes]);
  return h;
}
