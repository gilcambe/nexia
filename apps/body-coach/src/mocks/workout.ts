export type SessionState =
  | 'PRE_SESSION'
  | 'CHECK_IN'
  | 'SESSION_ADAPTATION'
  | 'WARMUP'
  | 'EXERCISE_ACTIVE'
  | 'SET_REST'
  | 'EXERCISE_COMPLETE'
  | 'NEXT_EXERCISE'
  | 'STRENGTH_COMPLETE'
  | 'CARDIO_DECISION'
  | 'CARDIO'
  | 'SESSION_REVIEW'
  | 'SESSION_COMPLETE';

export interface SetLog {
  id: string;
  set: number;
  weight: number;
  reps: number;
  rir: number | null;
  rpe: number | null;
  restSec: number;
  completed: boolean;
}

export interface PrevSet {
  set: number;
  weight: number;
  reps: number;
  rir: number | null;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  targetReps: string;
  targetSets: number;
  restSec: number;
  note: string;
  substituteNote?: string;
  videoUrl?: string;
  minWeight: number;
  maxWeight: number;
  weightUnit: string;
  prevSession: { date: string; sets: PrevSet[] };
  sets: SetLog[];
}

export interface Session {
  id: string;
  title: string;
  objective: string;
  estimatedMinutes: number;
  priority: 'alta' | 'media' | 'baixa';
  type: 'forca' | 'hif' | 'corrida' | 'recuperacao';
  date: string;
  warmup: { name: string; durationSec: number }[];
  exercises: Exercise[];
  cardio?: { type: string; note: string };
}

export interface SessionReview {
  duration: number;
  exercises: number;
  sets: number;
  volumeKg: number;
  progressions: { name: string; detail: string }[];
  notes: string;
  discomforts: string;
  cardio: string;
  changes: { made: string; reason: string }[];
  nextRecommendation: string;
}

export const session: Session = {
  id: 'sess-legs-0926',
  title: 'Treino de pernas — força / hipertrofia',
  objective: 'Hipertrofia de quadríceps e posteriores. Volume reduzido 20% hoje.',
  estimatedMinutes: 70,
  priority: 'alta',
  type: 'forca',
  date: 'Hoje',
  warmup: [
    { name: 'Bike leve', durationSec: 300 },
    { name: 'Mobilidade de quadril', durationSec: 180 },
    { name: 'Agachamento com peso corporal', durationSec: 120 },
  ],
  exercises: [
    {
      id: 'leg-press',
      name: 'Leg Press',
      muscleGroup: 'Quadríceps / glúteos',
      targetReps: '12–15',
      targetSets: 4,
      restSec: 120,
      note: 'Foco em amplitude completa, sem tirar o peso no fim.',
      minWeight: 100,
      maxWeight: 160,
      weightUnit: 'kg/lado',
      prevSession: {
        date: 'Sessão anterior · seg',
        sets: [
          { set: 1, weight: 100, reps: 15, rir: 2 },
          { set: 2, weight: 120, reps: 12, rir: 2 },
          { set: 3, weight: 120, reps: 12, rir: 2 },
          { set: 4, weight: 140, reps: 10, rir: 1 },
        ],
      },
      sets: [],
    },
    {
      id: 'agachamento',
      name: 'Agachamento livre',
      muscleGroup: 'Quadríceps',
      targetReps: '8–10',
      targetSets: 3,
      restSec: 150,
      note: 'Manter core firme, controle na descida, ~2s.',
      minWeight: 80,
      maxWeight: 120,
      weightUnit: 'kg',
      prevSession: {
        date: 'Sessão anterior · seg',
        sets: [
          { set: 1, weight: 80, reps: 10, rir: 2 },
          { set: 2, weight: 90, reps: 9, rir: 2 },
          { set: 3, weight: 90, reps: 8, rir: 1 },
        ],
      },
      sets: [],
    },
    {
      id: 'mesa-flexora',
      name: 'Mesa flexora',
      muscleGroup: 'Posteriores',
      targetReps: '10–12',
      targetSets: 3,
      restSec: 90,
      note: 'Controle excêntrico, sem balanço de quadril.',
      minWeight: 45,
      maxWeight: 70,
      weightUnit: 'kg',
      prevSession: {
        date: 'Sessão anterior · seg',
        sets: [
          { set: 1, weight: 50, reps: 12, rir: 2 },
          { set: 2, weight: 50, reps: 11, rir: 2 },
          { set: 3, weight: 55, reps: 10, rir: 1 },
        ],
      },
      sets: [],
    },
    {
      id: 'panturrilha',
      name: 'Panturrilha em pé',
      muscleGroup: 'Panturrilha',
      targetReps: '15–20',
      targetSets: 3,
      restSec: 60,
      note: 'Amplitude total, pausa de 1s no topo.',
      minWeight: 60,
      maxWeight: 90,
      weightUnit: 'kg',
      prevSession: {
        date: 'Sessão anterior · seg',
        sets: [{ set: 1, weight: 70, reps: 18, rir: 2 }],
      },
      sets: [],
    },
  ],
  cardio: { type: 'caminhada inclinada', note: 'Opcional após força, 10–15 min' },
};

export const sessionReview: SessionReview = {
  duration: 68,
  exercises: 4,
  sets: 12,
  volumeKg: 8140,
  progressions: [
    { name: 'Leg Press', detail: '+1 rep na última série (140×10 → 140×11), RIR 1' },
    { name: 'Mesa flexora', detail: 'Mantida carga, +1 rep na 2ª série' },
  ],
  notes: 'Execução estável, sem compensações. Última série de agachamento sentiu pegar no final.',
  discomforts: 'Nenhum desconforto relevante. Ombro direito leve, já monitorado.',
  cardio: 'Não realizado hoje — recuperação abaixo da linha.',
  changes: [
    { made: 'Volume reduzido 20% no leg press (4 séries de 12–15)', reason: 'Recuperação ~18% abaixo da linha (check-in + HRV)' },
  ],
  nextRecommendation: 'Próximo treino: upper-body (peito/dorso). Você está recuperando bem — mantenha o volume padrão, mas fique atento ao ombro direito.',
};

export const coachLogExamples = [
  'Registrado: 140 kg × 10. Ficou um pouco abaixo do alvo — busque 12–15 com RIR 2 na próxima.',
  'Fiz 12 com 70',
  '12/10/10 com 70/80/80',
  'as duas últimas ficaram difíceis',
  'máquina ocupada',
  'fiz cardio 35 min',
];