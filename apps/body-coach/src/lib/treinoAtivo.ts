import { useState, useEffect } from 'react';

export interface ExercicioAtivo {
  id?: string;
  name: string;
  setsCount?: number;
  [key: string]: any;
}

const TREINOS_ATIVO_KEY = 'bodycoach_treino_ativo';

export function getTreinoAtivo(): ExercicioAtivo | null {
  try {
    const raw = localStorage.getItem(TREINOS_ATIVO_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setTreinoAtivo(exercicio: ExercicioAtivo | null) {
  try {
    if (!exercicio) {
      localStorage.removeItem(TREINOS_ATIVO_KEY);
    } else {
      localStorage.setItem(TREINOS_ATIVO_KEY, JSON.stringify(exercicio));
    }
    window.dispatchEvent(new Event('treino-ativo-changed'));
  } catch {}
}

export function useTreinoAtivo() {
  const [exercicio, setExercicio] = useState<ExercicioAtivo | null>(getTreinoAtivo());

  useEffect(() => {
    function handleStorage() {
      setExercicio(getTreinoAtivo());
    }
    window.addEventListener('storage', handleStorage);
    window.addEventListener('treino-ativo-changed', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('treino-ativo-changed', handleStorage);
    };
  }, []);

  return [exercicio, setTreinoAtivo] as const;
}
