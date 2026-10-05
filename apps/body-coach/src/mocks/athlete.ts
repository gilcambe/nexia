export interface ReadinessMetric {
  key: string;
  label: string;
  value: number; // 0-100
  raw: string;
  note: string;
  source: string;
}

export interface Readiness {
  score: number;
  status: 'pronto' | 'atencao' | 'reduzir';
  summary: string;
  decision: string;
  why: string;
  metrics: ReadinessMetric[];
}

export interface DayFood {
  id: string;
  name: string;
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface MacroTarget {
  label: string;
  current: number;
  target: number;
  unit: string;
}

export interface Athlete {
  name: string;
  firstName: string;
  age: number;
  sex: string;
  height: number;
  weight: number;
  waist: number;
  unit: string;
  country: string;
  language: string;
  goal: string;
  modality: string[];
  level: string;
  availabilityDays: number;
  sessionMinutes: number;
  equipment: string[];
  preferredExercises: string[];
  avoidedExercises: string[];
  medical: {
    medicalHistory: string[];
    chronicConditions: string[];
    pastInjuries: { name: string; status: string; date: string }[];
    knownLimitations: string[];
    currentSymptoms: string[];
    medications: string[];
  };
  onboardingComplete: boolean;
  streak: number;
  totalSessions: number;
  thisWeekMinutes: number;
  nextCheckIn: string;
}

export const athlete: Athlete = {
  name: 'Rafael Moreira',
  firstName: 'Rafael',
  age: 29,
  sex: 'masculino',
  height: 178,
  weight: 82.4,
  waist: 84,
  unit: 'metric',
  country: 'Brasil',
  language: 'pt-BR',
  goal: 'hipertrofia',
  modality: ['musculacao', 'powerlifting'],
  level: 'avancado',
  availabilityDays: 4,
  sessionMinutes: 75,
  equipment: ['pesos_livres', 'maquinas'],
  preferredExercises: ['leg press', 'remo curvado', 'desenvolvimento com halteres'],
  avoidedExercises: ['abdução com carga máxima', 'levantamento terra convencional'],
  medical: {
    medicalHistory: ['Nenhuma condição crônica relevante'],
    chronicConditions: [],
    pastInjuries: [
      { name: 'Bursite no ombro direito', status: 'estavel', date: '2023-04' },
      { name: 'Torção leve no tornozelo esquerdo', status: 'resolvido', date: '2022-09' },
    ],
    knownLimitations: ['Evitar sobrecarga em abdução de ombro'],
    currentSymptoms: ['Nenhum sintoma atual'],
    medications: [],
  },
  onboardingComplete: false,
  streak: 12,
  totalSessions: 148,
  thisWeekMinutes: 236,
  nextCheckIn: 'diario',
};

export const readiness: Readiness = {
  score: 72,
  status: 'atencao',
  summary: 'Recuperação abaixo da sua linha normal, mas sem dor ou sinal de alerta.',
  decision: 'Hoje vamos reduzir 20% do volume do treino de pernas porque sua recuperação está ~18% abaixo da sua linha normal dos últimos 14 dias.',
  why: 'Sono de 6h20 (média 7h45) + fadiga reportada 7/10 + HRV 12% abaixo da sua linha. Isso não cancela o treino — apenas diminui o estímulo para manter a adaptação sem acumular fadiga.',
  metrics: [
    { key: 'sleep', label: 'Sono', value: 58, raw: '6h 20m', note: 'qualidade 64% · abaixo da média', source: 'check-in' },
    { key: 'recovery', label: 'Recuperação', value: 64, raw: '64/100', note: 'fadiga 7/10', source: 'check-in' },
    { key: 'energy', label: 'Energia', value: 66, raw: '6/10', note: 'moderada', source: 'check-in' },
    { key: 'stress', label: 'Estresse', value: 60, raw: '6/10', note: 'elevado', source: 'check-in' },
    { key: 'pain', label: 'Dor / desconforto', value: 90, raw: '1/10', note: 'ombro leve, gerenciável', source: 'check-in' },
    { key: 'hrv', label: 'HRV', value: 55, raw: '54 ms', note: '12% abaixo da linha', source: 'wearable' },
    { key: 'rhr', label: 'FC repouso', value: 48, raw: '61 bpm', note: '+3 bpm vs linha', source: 'wearable' },
  ],
};

export const dailyFood: DayFood[] = [
  { id: 'f1', name: 'Café da manhã — omelete + pão integral', time: '07:30', calories: 520, protein: 38, carbs: 48, fat: 20, fiber: 7 },
  { id: 'f2', name: 'Lanche — iogurte + granola', time: '10:20', calories: 310, protein: 21, carbs: 34, fat: 9, fiber: 4 },
  { id: 'f3', name: 'Almoço — frango + arroz + legumes', time: '12:40', calories: 640, protein: 52, carbs: 68, fat: 14, fiber: 9 },
];

export const macroTotals = {
  calories: { current: 1470, target: 2850, unit: 'kcal' },
  protein: { current: 111, target: 180, unit: 'g' },
  carbs: { current: 150, target: 320, unit: 'g' },
  fat: { current: 43, target: 85, unit: 'g' },
  fiber: { current: 20, target: 35, unit: 'g' },
  water: { current: 1.4, target: 3.1, unit: 'L' },
};

export const macroTargets: MacroTarget[] = [
  { label: 'Calorias', current: 1470, target: 2850, unit: 'kcal' },
  { label: 'Proteína', current: 111, target: 180, unit: 'g' },
  { label: 'Carboidratos', current: 150, target: 320, unit: 'g' },
  { label: 'Gordura', current: 43, target: 85, unit: 'g' },
];

export const remainingMessage =
  'Com base no seu objetivo de hipertrofia (superávit leve) e no que você já comeu hoje (1.470 kcal / 111g proteína), você ainda pode consumir ~1.380 kcal. Priorize ~70g de proteína nas próximas refeições e não corte gordura de forma agressiva.';