export interface PlanExercise {
  name: string;
  sets: string;
  target: string;
}

export interface PlanDay {
  id: string;
  day: string;
  title: string;
  focus: string;
  duration: number;
  intensity: 'baixa' | 'media' | 'alta';
  exercises: PlanExercise[];
  done?: boolean;
  next?: boolean;
}

export interface Phase {
  id: string;
  name: string;
  period: string;
  objective: string;
  distance: number; // percent completed 0-100
  current?: boolean;
}

export const planWeek: PlanDay[] = [
  {
    id: 'mon',
    day: 'Segunda',
    title: 'Pernas — força / hipertrofia',
    focus: 'Quadríceps + posteriores',
    duration: 70,
    intensity: 'alta',
    exercises: [
      { name: 'Leg Press', sets: '4 × 12–15', target: 'RIR 2' },
      { name: 'Agachamento livre', sets: '3 × 8–10', target: 'RIR 2' },
      { name: 'Mesa flexora', sets: '3 × 10–12', target: 'RIR 2' },
      { name: 'Panturrilha em pé', sets: '3 × 15–20', target: 'RIR 2' },
    ],
    done: false,
    next: true,
  },
  {
    id: 'tue',
    day: 'Terça',
    title: 'Upper — peito / dorso',
    focus: 'Empurrar + puxar',
    duration: 75,
    intensity: 'media',
    exercises: [
      { name: 'Supino inclinado com halteres', sets: '4 × 10–12', target: 'RIR 2' },
      { name: 'Remada curvada', sets: '4 × 10–12', target: 'RIR 2' },
      { name: 'Desenvolvimento com halteres', sets: '3 × 10–12', target: 'RIR 2' },
      { name: 'Puxada frontal', sets: '3 × 12–15', target: 'RIR 2' },
    ],
  },
  {
    id: 'wed',
    day: 'Quarta',
    title: 'Recuperação ativa',
    focus: 'Mobilidade + cardio leve',
    duration: 30,
    intensity: 'baixa',
    exercises: [
      { name: 'Caminhada inclinada', sets: '20 min', target: 'zona 2' },
      { name: 'Mobilidade de quadril / ombro', sets: '10 min', target: 'amplitude' },
    ],
  },
  {
    id: 'thu',
    day: 'Quinta',
    title: 'Pernas — volume',
    focus: 'Volume moderado',
    duration: 72,
    intensity: 'media',
    exercises: [
      { name: 'Leg press', sets: '4 × 12–15', target: 'RIR 2' },
      { name: 'Cadeira extensora', sets: '3 × 15', target: 'RIR 2' },
      { name: 'Stiff', sets: '3 × 10–12', target: 'RIR 2' },
    ],
  },
  {
    id: 'sat',
    day: 'Sábado',
    title: 'PEITO / OMBRO',
    focus: 'Empurrar',
    duration: 65,
    intensity: 'alta',
    exercises: [
      { name: 'Supino reto com barra', sets: '4 × 8–10', target: 'RIR 1' },
      { name: 'Crucifixo na máquina', sets: '3 × 12–15', target: 'RIR 2' },
      { name: 'Elevação lateral', sets: '3 × 15', target: 'RIR 2' },
    ],
  },
];

export const phases: Phase[] = [
  { id: 'p1', name: 'Base / adaptação', period: 'Sem 1–4', objective: 'Construir volume e técnica de base.', distance: 100 },
  { id: 'p2', name: 'Hipertrofia', period: 'Sem 5–10', objective: 'Ganho de massa com progressão controlada.', distance: 62, current: true },
  { id: 'p3', name: 'Força / pico', period: 'Sem 11–14', objective: 'Aumento de cargas e RIR reduzido.', distance: 0 },
];

export const planNotes =
  'Conforme a sua recuperação (readiness diário), o plano se adapta automaticamente: se o sleep estiver abaixo da linha, o sistema reduz volume e ajusta a intensidade antes de você começar.';