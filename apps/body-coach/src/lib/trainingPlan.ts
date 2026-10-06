// Plano de treino da semana montado a partir do questionário (dias, minutos e nível).
import type { PlanDay } from '@/mocks/plan';
import type { Session } from '@/mocks/workout';

export type Answers = Record<string, string | string[] | undefined>;

type Template = [day: string, title: string, focus: string, exercises: string[]];

const SPLITS: Record<number, Template[]> = {
  3: [
    ['Segunda', 'Corpo inteiro A', 'Pernas, peito e costas', ['Agachamento livre', 'Supino reto', 'Remada curvada', 'Elevação pélvica']],
    ['Quarta', 'Corpo inteiro B', 'Posteriores, ombros e costas', ['Levantamento terra romeno', 'Desenvolvimento com halteres', 'Puxada frontal', 'Prancha']],
    ['Sexta', 'Corpo inteiro C', 'Pernas, peito e braços', ['Leg Press', 'Supino inclinado com halteres', 'Remada baixa', 'Rosca direta']],
  ],
  4: [
    ['Segunda', 'Superior A', 'Peito e costas', ['Supino reto', 'Remada curvada', 'Desenvolvimento com halteres', 'Tríceps na polia']],
    ['Terça', 'Inferior A', 'Quadríceps', ['Agachamento livre', 'Leg Press', 'Cadeira extensora', 'Panturrilha em pé']],
    ['Quinta', 'Superior B', 'Costas e ombros', ['Puxada frontal', 'Supino inclinado com halteres', 'Elevação lateral', 'Rosca direta']],
    ['Sexta', 'Inferior B', 'Posteriores e glúteos', ['Levantamento terra romeno', 'Elevação pélvica', 'Mesa flexora', 'Prancha']],
  ],
  5: [
    ['Segunda', 'Peito e tríceps', 'Empurrar', ['Supino reto', 'Supino inclinado com halteres', 'Crucifixo', 'Tríceps na polia']],
    ['Terça', 'Costas e bíceps', 'Puxar', ['Puxada frontal', 'Remada curvada', 'Remada baixa', 'Rosca direta']],
    ['Quarta', 'Pernas', 'Quadríceps', ['Agachamento livre', 'Leg Press', 'Cadeira extensora', 'Panturrilha em pé']],
    ['Quinta', 'Ombros e core', 'Ombros', ['Desenvolvimento com halteres', 'Elevação lateral', 'Face pull', 'Prancha']],
    ['Sexta', 'Posteriores e glúteos', 'Posteriores', ['Levantamento terra romeno', 'Elevação pélvica', 'Mesa flexora', 'Abdução de quadril']],
  ],
  6: [
    ['Segunda', 'Empurrar A', 'Peito, ombros e tríceps', ['Supino reto', 'Desenvolvimento com halteres', 'Elevação lateral', 'Tríceps na polia']],
    ['Terça', 'Puxar A', 'Costas e bíceps', ['Puxada frontal', 'Remada curvada', 'Face pull', 'Rosca direta']],
    ['Quarta', 'Pernas A', 'Quadríceps', ['Agachamento livre', 'Leg Press', 'Cadeira extensora', 'Panturrilha em pé']],
    ['Quinta', 'Empurrar B', 'Peito e ombros', ['Supino inclinado com halteres', 'Crucifixo', 'Elevação lateral', 'Tríceps francês']],
    ['Sexta', 'Puxar B', 'Costas', ['Remada baixa', 'Puxada frontal', 'Remada unilateral', 'Rosca martelo']],
    ['Sábado', 'Pernas B', 'Posteriores e glúteos', ['Levantamento terra romeno', 'Elevação pélvica', 'Mesa flexora', 'Abdução de quadril']],
  ],
};

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function dose(level: unknown): { sets: string; target: string; intensity: PlanDay['intensity'] } {
  if (level === 'Iniciante') return { sets: '3 × 10–12', target: 'RIR 3', intensity: 'baixa' };
  if (level === 'Avançado' || level === 'Alto desempenho') return { sets: '4 × 6–10', target: 'RIR 1', intensity: 'alta' };
  return { sets: '3 × 8–12', target: 'RIR 2', intensity: 'media' };
}

export function buildWeekPlan(ob: Answers): PlanDay[] {
  const n = Number(ob.days);
  const split = SPLITS[n] ?? SPLITS[3];
  const duration = Number(ob.minutes) || 60;
  const { sets, target, intensity } = dose(ob.level);
  return split.map(([day, title, focus, names], i) => ({
    id: `d${i}`,
    day,
    title,
    focus,
    duration,
    intensity,
    exercises: names.map((name) => ({ name, sets, target })),
  }));
}

// Dia do plano que cai hoje, ou null em dia de descanso.
export function todayPlanDay(plan: PlanDay[]): PlanDay | null {
  const today = WEEKDAYS[new Date().getDay()];
  return plan.find((d) => d.day === today) ?? null;
}

const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function buildSession(day: PlanDay): Session {
  return {
    id: `sess-${day.id}-${isoToday()}`,
    title: day.title,
    objective: day.focus,
    estimatedMinutes: day.duration,
    priority: 'media',
    type: 'forca',
    date: 'Hoje',
    warmup: [
      { name: 'Aquecimento leve (bike ou esteira)', durationSec: 300 },
      { name: 'Mobilidade articular', durationSec: 180 },
    ],
    exercises: day.exercises.map((e) => ({
      id: e.name.toLowerCase().replace(/\s+/g, '-'),
      name: e.name,
      muscleGroup: day.focus,
      targetReps: e.sets.split('× ')[1] ?? e.sets,
      targetSets: parseInt(e.sets, 10) || 3,
      restSec: 90,
      note: `Alvo ${e.target}.`,
      minWeight: 0,
      maxWeight: 200,
      weightUnit: 'kg',
      prevSession: { date: 'Sem registro anterior', sets: [] },
      sets: [],
    })),
  };
}
