import type { PlanDay } from '@/mocks/plan';
import type { Session } from '@/mocks/workout';

export type Answers = Record<string, string | string[] | undefined>;

export function buildWeekPlan(ob: Answers): PlanDay[] {
  const daysCount = Number(ob['daysPerWeek'] ?? ob['days'] ?? 3);
  const goal = String(ob['goal'] ?? ob['objective'] ?? 'hipertrofia');
  const level = String(ob['level'] ?? 'intermediario');

  const baseDays: PlanDay[] = [
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
      id: 'fri',
      day: 'Sexta',
      title: 'Upper — braços / ombros',
      focus: 'Membros superiores',
      duration: 60,
      intensity: 'media',
      exercises: [
        { name: 'Rosca direta com barra', sets: '3 × 10–12', target: 'RIR 2' },
        { name: 'Tríceps testa', sets: '3 × 10–12', target: 'RIR 2' },
        { name: 'Elevação lateral', sets: '4 × 15', target: 'RIR 2' },
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
    {
      id: 'sun',
      day: 'Domingo',
      title: 'Descanso total',
      focus: 'Recuperação',
      duration: 0,
      intensity: 'baixa',
      exercises: [],
    },
  ];

  const count = isNaN(daysCount) || daysCount <= 0 ? 3 : Math.min(Math.max(daysCount, 1), 7);
  return baseDays.slice(0, count);
}
