export interface EvolutionPoint {
  label: string;
  peso: number;
  cintura: number;
}

export interface StrengthPoint {
  label: string;
  legPress: number;
  agachamento: number;
}

export interface MeasurementRegion {
  key: string;
  label: string;
  value: number;
  unit: string;
  delta: number; // change vs baseline
  trend: 'up' | 'down' | 'flat';
  confidence: 'alta' | 'media' | 'estimada';
  source: 'medido' | 'estimado';
}

export interface BodyTwin {
  height: number;
  weight: number;
  bodyFat: number;
  leanMass: number;
  regions: MeasurementRegion[];
}

export interface PersonalRecord {
  exercise: string;
  value: string;
  date: string;
  type: 'PR' | 'e1RM' | 'volume';
}

export interface Correlation {
  id: string;
  label: string;
  value: string;
  note: string;
  direction: 'positivo' | 'negativo' | 'neutro';
}

export const weightTrend: EvolutionPoint[] = [
  { label: 'Julho', peso: 80.1, cintura: 86.2 },
  { label: 'Jul', peso: 80.6, cintura: 85.9 },
  { label: 'Sem 1', peso: 81.0, cintura: 85.5 },
  { label: 'Sem 2', peso: 81.3, cintura: 85.2 },
  { label: 'Sem 3', peso: 81.9, cintura: 84.8 },
  { label: 'Sem 4', peso: 82.1, cintura: 84.5 },
  { label: 'Sem 5', peso: 82.4, cintura: 84.0 },
];

export const strengthTrend: StrengthPoint[] = [
  { label: 'M1', legPress: 140, agachamento: 95 },
  { label: 'M2', legPress: 145, agachamento: 100 },
  { label: 'M3', legPress: 150, agachamento: 105 },
  { label: 'M4', legPress: 155, agachamento: 110 },
  { label: 'M5', legPress: 160, agachamento: 115 },
];

export const bodyTwin: BodyTwin = {
  height: 178,
  weight: 82.4,
  bodyFat: 16,
  leanMass: 69.2,
  regions: [
    { key: 'peito', label: 'Peitoral', value: 102, unit: 'cm', delta: 1.2, trend: 'up', confidence: 'alta', source: 'medido' },
    { key: 'ombro', label: 'Ombros', value: 118, unit: 'cm', delta: 0.8, trend: 'up', confidence: 'alta', source: 'medido' },
    { key: 'cintura', label: 'Cintura', value: 84, unit: 'cm', delta: -2.2, trend: 'down', confidence: 'alta', source: 'medido' },
    { key: 'quadril', label: 'Quadril', value: 96, unit: 'cm', delta: 0.3, trend: 'flat', confidence: 'alta', source: 'medido' },
    { key: 'bracos', label: 'Braço', value: 38.5, unit: 'cm', delta: 0.4, trend: 'up', confidence: 'media', source: 'medido' },
    { key: 'ante', label: 'Antebraço', value: 30, unit: 'cm', delta: 0.1, trend: 'flat', confidence: 'media', source: 'medido' },
    { key: 'coxa', label: 'Coxa', value: 60, unit: 'cm', delta: 0.9, trend: 'up', confidence: 'media', source: 'medido' },
    { key: 'pantur', label: 'Panturrilha', value: 39, unit: 'cm', delta: 0.2, trend: 'flat', confidence: 'media', source: 'medido' },
    { key: 'pescoco', label: 'Pescoço', value: 39, unit: 'cm', delta: 0, trend: 'flat', confidence: 'media', source: 'estimado' },
    { key: 'gordura', label: 'Gordura corporal', value: 16, unit: '%', delta: -1.8, trend: 'down', confidence: 'estimada', source: 'estimado' },
    { key: 'massa', label: 'Massa magra', value: 69.2, unit: 'kg', delta: 2.4, trend: 'up', confidence: 'estimada', source: 'estimado' },
  ],
};

export const personalRecords: PersonalRecord[] = [
  { exercise: 'Leg Press', value: '160 kg/lado × 11', date: 'há 2 dias', type: 'PR' },
  { exercise: 'Agachamento livre', value: '115 kg × 8', date: 'há 1 semana', type: 'PR' },
  { exercise: 'Supino inclinado', value: '72 kg × 10', date: 'há 3 dias', type: 'PR' },
  { exercise: 'Agachamento', value: 'e1RM ~137 kg', date: 'calculado', type: 'e1RM' },
  { exercise: 'Volume semanal (pernas)', value: '+12% vs média', date: 'últimas 4 sem', type: 'volume' },
];

export const correlations: Correlation[] = [
  { id: 'co1', label: 'Sono longo → desempenho', value: 'forte', note: 'Quando você dorme 7h45+, o leg press sobe ~5%.', direction: 'positivo' },
  { id: 'co2', label: 'Sono curto → RPE alto', value: 'moderado', note: 'Sessões pós-noite ruim têm RPE +1 média.', direction: 'negativo' },
  { id: 'co3', label: 'Proteína alta → recuperação', value: 'moderado', note: 'Dias com 180g+ de proteína mostram melhor readiness no dia seguinte.', direction: 'positivo' },
];

export const evolutionSummary =
  'Nas últimas 6 semanas: +2.3 kg de peso, cintura −2.2 cm, massa magra estimada +2.4 kg e força em alta. Padrão consistente com evolução positiva — peso subindo com cintura caindo e performance melhorando.';

export const bodyGoal = {
  bodyFat: 12,
  leanMass: 72.5,
};

// Fotos de acompanhamento (datas diferentes) para comparar progresso real.
export interface ProgressPhoto {
  id: string;
  date: string;
  label: string;
  weight: number;
  bodyFat: number;
  src: string;
}

export const progressPhotos: ProgressPhoto[] = [
  {
    id: 'ph-1',
    date: '2026-09-08',
    label: 'Hoje',
    weight: 82.4,
    bodyFat: 16,
    src: `${import.meta.env.BASE_URL}imagens/bt-progress-hoje.jpg`,
  },
  {
    id: 'ph-2',
    date: '2026-08-08',
    label: '1 mês atrás',
    weight: 81.2,
    bodyFat: 17.2,
    src: `${import.meta.env.BASE_URL}imagens/bt-progress-mes1.jpg`,
  },
  {
    id: 'ph-3',
    date: '2026-07-08',
    label: '2 meses atrás',
    weight: 80.1,
    bodyFat: 18.5,
    src: `${import.meta.env.BASE_URL}imagens/bt-progress-mes1.jpg`,
  },
];