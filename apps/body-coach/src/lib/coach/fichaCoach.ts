// Ficha de treino montada pelo coach para um aluno (gravada no perfil do aluno pelo servidor:
// profile/main campos "ficha_coach" e "ficha_coach_dia"). O aluno segue os treinos em ciclo, A → B → C → A.
import type { Exercise, Session } from '@/mocks/workout';
import { DIVISOES, montarTreinoDoDia, type Divisao } from '../dayPlan';
import { demoDoExercicio, POR_ID } from '../exerciseDb';
import { estadoPadrao } from '../ficha';

export interface ExercicioCoach { id: string; nome: string; grupo: string; series: number; reps: string; descanso: number; carga: string; obs: string }
export interface DiaCoach { titulo: string; exercicios: ExercicioCoach[] }
export interface FichaCoach { nome: string; obs: string; dias: DiaCoach[]; coach?: string; em?: number }

export const temFichaCoach = (f: unknown): f is FichaCoach =>
  !!f && typeof f === 'object' && Array.isArray((f as FichaCoach).dias) && (f as FichaCoach).dias.some((d) => d && Array.isArray(d.exercicios) && d.exercicios.length > 0);

export function diaDaFichaCoach(ficha: FichaCoach, dia: unknown): number {
  const n = Number(dia);
  return Number.isInteger(n) && n >= 0 && n < ficha.dias.length ? n : 0;
}

export const proximoDiaCoach = (ficha: FichaCoach, dia: number) => (dia + 1) % ficha.dias.length;

// Exercício livre (que não está no banco): id a partir do nome.
export const idDoNome = (nome: string) => `livre-${nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)}`;

export function novoExercicio(id: string, nome?: string): ExercicioCoach {
  const x = POR_ID[id];
  return { id, nome: x?.nome ?? nome ?? id, grupo: x?.grupo ?? '', series: 3, reps: x && !x.composto ? '12–15' : '8–12', descanso: x && !x.composto ? 75 : 120, carga: '', obs: '' };
}

// Treino de um dia da ficha do coach no formato que a tela de treino usa.
export function sessaoDaFichaCoach(ficha: FichaCoach, dia: number): Session {
  const d = ficha.dias[diaDaFichaCoach(ficha, dia)];
  const hoje = new Date().toISOString().slice(0, 10);
  const exercicios: Exercise[] = d.exercicios.map((x, i) => ({
    id: x.id || `ex-${i}`,
    name: x.nome,
    muscleGroup: x.grupo || POR_ID[x.id]?.grupo || '',
    targetReps: x.reps || '8–12',
    targetSets: x.series || 3,
    restSec: Number.isFinite(x.descanso) ? x.descanso : 90,
    note: [x.carga ? `Carga do coach: ${x.carga}.` : '', x.obs].filter(Boolean).join(' ') || `${x.series} séries de ${x.reps}.`,
    videoUrl: demoDoExercicio(x.id)?.[0] ?? '',
    minWeight: 0,
    maxWeight: 300,
    weightUnit: 'kg',
    prevSession: { date: 'Sem registro anterior', sets: [] },
    sets: [],
  }));
  return {
    id: `coach-${dia}-${hoje}`,
    title: d.titulo,
    objective: ficha.nome,
    estimatedMinutes: Math.max(15, Math.round(exercicios.reduce((a, e) => a + e.targetSets * (1 + e.restSec / 60), 8))),
    priority: 'media',
    type: 'forca',
    date: 'Hoje',
    warmup: [
      { name: 'Aquecimento leve (bike ou esteira)', durationSec: 300 },
      { name: 'Mobilidade articular', durationSec: 180 },
    ],
    exercises: exercicios,
  };
}

// Rascunho automático para o coach: a mesma regra do app (nível, objetivo, lesões, limitações do aluno),
// um dia por treino da divisão escolhida. O coach só ajusta.
export function rascunhoDaFicha(respostas: Record<string, unknown>, divisao: Divisao): FichaCoach {
  const dias = DIVISOES[divisao].dias.map((d, i) => {
    const t = montarTreinoDoDia({ respostas, divisao, diaDaDivisao: i, enfase: [], estado: estadoPadrao(respostas), variacao: 0 });
    return {
      titulo: d.titulo,
      exercicios: t.sessao.exercises.map((e) => ({ id: e.id, nome: e.name, grupo: e.muscleGroup, series: e.targetSets, reps: e.targetReps, descanso: e.restSec, carga: '', obs: '' })),
    };
  });
  return { nome: `Ficha ${DIVISOES[divisao].nome}`, obs: '', dias };
}
