// Periodização (mesociclos): organiza as semanas em fases com volume, intensidade e descanso diferentes,
// com semana de descarga (deload) a cada 4. Modelo ondulatório por blocos, usado por personais.

export type Objetivo = 'hipertrofia' | 'forca' | 'emagrecimento' | 'resistencia';

export interface SemanaPlano {
  semana: number;
  fase: string;
  series: string;
  reps: string;
  esforco: string; // RIR / %1RM
  descanso: string;
  cardio: string;
  foco: string;
  deload: boolean;
}

export const OBJETIVOS: { id: Objetivo; nome: string; desc: string }[] = [
  { id: 'hipertrofia', nome: 'Hipertrofia', desc: 'Ganhar massa muscular' },
  { id: 'forca', nome: 'Força', desc: 'Levantar mais peso' },
  { id: 'emagrecimento', nome: 'Emagrecimento', desc: 'Perder gordura mantendo músculo' },
  { id: 'resistencia', nome: 'Resistência', desc: 'Condicionamento e fôlego' },
];

type Fase = Omit<SemanaPlano, 'semana' | 'deload'>;
const FASES: Record<Objetivo, Fase[]> = {
  hipertrofia: [
    { fase: 'Adaptação', series: '3', reps: '12–15', esforco: 'RIR 3 (~65% 1RM)', descanso: '60–75 s', cardio: '2× 20 min leve', foco: 'Técnica perfeita e cadência controlada (2 s descendo).' },
    { fase: 'Acumulação', series: '4', reps: '10–12', esforco: 'RIR 2 (~70% 1RM)', descanso: '75–90 s', cardio: '2× 20 min leve', foco: 'Aumentar o volume: some 1 série nos exercícios principais.' },
    { fase: 'Intensificação', series: '4', reps: '8–10', esforco: 'RIR 1 (~75–78% 1RM)', descanso: '90–120 s', cardio: '2× 15 min', foco: 'Subir carga toda semana mantendo a técnica.' },
    { fase: 'Choque', series: '4–5', reps: '6–8 + drop-set', esforco: 'RIR 0–1 (~80% 1RM)', descanso: '2 min', cardio: '2× 15 min', foco: 'Última série com drop-set ou rest-pause nos principais.' },
  ],
  forca: [
    { fase: 'Base', series: '4', reps: '8', esforco: 'RIR 3 (~70% 1RM)', descanso: '2 min', cardio: '1× 20 min leve', foco: 'Padrão de movimento nos básicos: agachamento, supino, terra, remada.' },
    { fase: 'Força', series: '5', reps: '5', esforco: 'RIR 2 (~80% 1RM)', descanso: '3 min', cardio: '1× 20 min leve', foco: 'Progressão linear: +2,5 kg por semana nos básicos.' },
    { fase: 'Intensidade', series: '5', reps: '3', esforco: 'RIR 1 (~87% 1RM)', descanso: '3–4 min', cardio: '1× 15 min', foco: 'Cargas altas com repetições poucas e perfeitas.' },
    { fase: 'Pico', series: '3–4', reps: '1–2', esforco: '~92–95% 1RM', descanso: '4–5 min', cardio: 'Opcional', foco: 'Teste de recorde na última sessão com segurança (com ajuda).' },
  ],
  emagrecimento: [
    { fase: 'Adaptação', series: '3', reps: '12–15', esforco: 'RIR 3', descanso: '45–60 s', cardio: '3× 25 min moderado', foco: 'Criar o hábito: 3 a 4 treinos por semana.' },
    { fase: 'Metabólica', series: '3–4', reps: '12–15 em bi-set', esforco: 'RIR 2', descanso: '30–45 s', cardio: '3× 30 min + 1 HIIT', foco: 'Bi-sets e circuitos para gastar mais em menos tempo.' },
    { fase: 'Força para manter músculo', series: '4', reps: '8–10', esforco: 'RIR 1–2', descanso: '90 s', cardio: '2× 30 min + 2 HIIT', foco: 'Carga alta protege a massa magra no déficit.' },
    { fase: 'Definição', series: '4', reps: '10–12 + finalizador', esforco: 'RIR 1', descanso: '45–60 s', cardio: '3× 30 min + 2 HIIT', foco: 'Finalize com 8 min de HIIT ou abdômen.' },
  ],
  resistencia: [
    { fase: 'Base aeróbica', series: '2–3', reps: '15–20', esforco: 'RIR 3', descanso: '30–45 s', cardio: '4× 30 min zona 2', foco: 'Volume de cardio leve (dá para conversar).' },
    { fase: 'Limiar', series: '3', reps: '15', esforco: 'RIR 2', descanso: '30 s', cardio: '3× 30 min + 1 tiro longo', foco: 'Tiros de 5–8 min em ritmo forte (zona 4).' },
    { fase: 'Potência', series: '3', reps: '8–10 explosivas', esforco: 'RIR 2', descanso: '60 s', cardio: '2× 30 min + 2 tiros curtos', foco: 'Saltos, sprints de 30 s e circuitos.' },
    { fase: 'Pico', series: '2–3', reps: '12', esforco: 'RIR 2', descanso: '45 s', cardio: 'Prova ou teste de 5 km', foco: 'Reduza o volume e faça seu teste.' },
  ],
};

const DELOAD: Fase = { fase: 'Descarga (deload)', series: '2', reps: 'as mesmas', esforco: 'RIR 4 (~60% 1RM)', descanso: 'livre', cardio: 'Leve, caminhada', foco: 'Metade do volume. O corpo assimila o que treinou e volta mais forte.' };

// Monta as semanas: 3 semanas de treino + 1 de descarga, avançando de fase a cada bloco.
export function montarPeriodizacao(objetivo: Objetivo, semanas: number): SemanaPlano[] {
  const fases = FASES[objetivo] ?? FASES.hipertrofia;
  const total = Math.min(24, Math.max(4, Math.round(semanas / 4) * 4));
  const blocos = total / 4;
  const out: SemanaPlano[] = [];
  for (let b = 0; b < blocos; b++) {
    const f = fases[Math.min(fases.length - 1, Math.floor((b * fases.length) / blocos))];
    for (let s = 0; s < 3; s++) out.push({ semana: out.length + 1, ...f, deload: false });
    out.push({ semana: out.length + 1, ...DELOAD, deload: true });
  }
  return out;
}

export function semanaAtual(inicio: string, agora = new Date()): number {
  const ini = new Date(inicio + 'T00:00:00').getTime();
  if (isNaN(ini)) return 1;
  return Math.floor((agora.getTime() - ini) / (7 * 86400000)) + 1;
}

export function objetivoDoPerfil(goal: unknown): Objetivo {
  const g = String(goal ?? '').toLowerCase();
  if (/for[cç]a/.test(g)) return 'forca';
  if (/emagre|perd|gordura|defini|secar/.test(g)) return 'emagrecimento';
  if (/resist|corrid|condicion|maratona|prova/.test(g)) return 'resistencia';
  return 'hipertrofia';
}
