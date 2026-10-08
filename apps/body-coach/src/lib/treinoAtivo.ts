import { useState, useEffect } from 'react';

export interface ExercicioAtivo {
  id?: string;
  name: string;
  setsCount?: number;
  [key: string]: any;
}

const TREINOS_ATIVO_KEY = 'bodycoach_treino_ativo';

export function getTreinoAtivo(): ExercicioAtivo | null {\n  try {\n    const raw = localStorage.getItem(TREINOS_ATIVO_KEY);\n    if (!raw) return null;\n    return JSON.parse(raw);\n  } catch {\n    return null;\n  }\n}\n

export function setTreinoAtivo(exercicio: ExercicioAtivo | null) {\n  try {\n    if (!exercicio) {\n      localStorage.removeItem(TREINOS_ATIVO_KEY);\n    } else {\n      localStorage.setItem(TREINOS_ATIVO_KEY, JSON.stringify(exercicio));\n    }\n    window.dispatchEvent(new Event('treino-ativo-changed'));\n  } catch {}\n}\n

export function useTreinoAtivo() {\n  const [exercicio, setExercicio] = useState<ExercicioAtivo | null>(getTreinoAtivo());\n\n  useEffect(() => {\n    function handleStorage() {\n      setExercicio(getTreinoAtivo());\n    }\n    window.addEventListener('storage', handleStorage);\n    window.addEventListener('treino-ativo-changed', handleStorage);\n    return () => {\n      window.removeEventListener('storage', handleStorage);\n      window.removeEventListener('treino-ativo-changed', handleStorage);\n    };\n  }, []);\n\n  return [exercicio, setTreinoAtivo] as const;\n}\n