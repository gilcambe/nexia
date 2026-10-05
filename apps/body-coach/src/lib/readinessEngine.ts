export interface ReadinessInput {
  sleepHours: number;
  sleepQuality: number; // 1-5
  soreness: number; // 1-10
  fatigue: number; // 1-10
  energy: number; // 1-10
  stress: number; // 1-10
  painLevel: number; // 0-10
  hrv?: number | null;
  rhr?: number | null;
}

export type ReadinessStatus = 'pronto' | 'atencao' | 'reduzir';

export interface ReadinessMetric {
  key: string;
  label: string;
  value: number;
  raw: string;
  note: string;
}

export interface ReadinessResult {
  score: number;
  status: ReadinessStatus;
  summary: string;
  decision: string;
  why: string;
  metrics: ReadinessMetric[];
}

export const statusMeta = {
  pronto: { label: 'Pronto', color: 'oklch(var(--accent-500))', text: 'text-accent-600' },
  atencao: { label: 'Atenção', color: 'oklch(var(--primary-500))', text: 'text-primary-600' },
  reduzir: { label: 'Reduzir', color: 'oklch(var(--primary-600))', text: 'text-primary-700' },
} as const;

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));

function fmtHours(h: number): string {
  const totalMin = Math.round(h * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  return mm === 0 ? `${hh}h` : `${hh}h${String(mm).padStart(2, '0')}`;
}

export function computeReadiness(input: ReadinessInput): ReadinessResult {
  const hoursPct = clamp((input.sleepHours / 8) * 100);
  const qualityPct = clamp((input.sleepQuality / 5) * 100);
  const sleepScore = Math.round(0.6 * hoursPct + 0.4 * qualityPct);

  const recoveryScore = clamp((10 - input.fatigue) * 10);
  const energyScore = clamp(input.energy * 10);
  const sorenessScore = clamp((10 - input.soreness) * 10);
  const stressScore = clamp((10 - input.stress) * 10);
  const painScore = clamp((10 - input.painLevel) * 10);

  const score = clamp(
    Math.round(
      0.25 * sleepScore +
        0.25 * recoveryScore +
        0.15 * energyScore +
        0.1 * sorenessScore +
        0.1 * stressScore +
        0.15 * painScore,
    ),
  );

  const status: ReadinessStatus = score >= 78 ? 'pronto' : score >= 60 ? 'atencao' : 'reduzir';

  const metrics: ReadinessMetric[] = [
    { key: 'sleep', label: 'Sono', value: sleepScore, raw: fmtHours(input.sleepHours), note: `qualidade ${input.sleepQuality}/5` },
    { key: 'recovery', label: 'Recuperação', value: recoveryScore, raw: `${Math.round(input.fatigue)}/10`, note: 'fadiga reportada' },
    { key: 'energy', label: 'Energia', value: energyScore, raw: `${Math.round(input.energy)}/10`, note: 'subjetiva' },
    { key: 'soreness', label: 'Dores musculares', value: sorenessScore, raw: `${Math.round(input.soreness)}/10`, note: 'DOMS' },
    { key: 'stress', label: 'Estresse', value: stressScore, raw: `${Math.round(input.stress)}/10`, note: 'subjetivo' },
    { key: 'pain', label: 'Dor / desconforto', value: painScore, raw: `${Math.round(input.painLevel)}/10`, note: '0 = sem dor' },
  ];

  const factors: string[] = [];
  if (input.sleepHours < 6.5) factors.push(`sono curto (${fmtHours(input.sleepHours)})`);
  if (input.fatigue >= 7) factors.push('fadiga elevada');
  if (input.stress >= 7) factors.push('estresse alto');
  if (input.painLevel >= 4) factors.push('dor acima do normal');
  if (input.soreness >= 7) factors.push('dores musculares fortes');
  if (factors.length === 0) factors.push('recuperação dentro do esperado');

  const summary =
    status === 'pronto'
      ? `Recuperação boa — ${factors.join(', ')}. Pronto para treinar com intensidade.`
      : status === 'atencao'
        ? `Recuperação um pouco abaixo da linha (${factors.join(', ')}). Treinar com ajustes.`
        : `Recuperação comprometida (${factors.join(', ')}). Priorizar recuperação hoje.`;

  let decision = '';
  if (input.painLevel >= 4) {
    decision =
      'Evitar sobrecarga na região dolorida e priorizar mobilidade + trabalho leve. Se a dor piorar ou houver perda de função, parar e buscar avaliação.';
  } else if (status === 'reduzir') {
    decision =
      'Reduzir volume ~30% e intensidade, mantendo o movimento. Foco em técnica e ativação, sem forçar.';
  } else if (status === 'atencao') {
    decision =
      'Reduzir volume ~15–20% e evitar falha total nas últimas séries. Manter estímulo sem acumular fadiga.';
  } else {
    decision =
      'Treinar normalmente, priorizando progressão de carga nos exercícios principais.';
  }

  const whyParts = [
    `Sono ${fmtHours(input.sleepHours)} (qualidade ${input.sleepQuality}/5)`,
    `fadiga ${Math.round(input.fatigue)}/10, energia ${Math.round(input.energy)}/10`,
    `dores musculares ${Math.round(input.soreness)}/10, estresse ${Math.round(input.stress)}/10, dor ${Math.round(input.painLevel)}/10`,
  ];
  if (input.hrv != null) whyParts.push(`HRV ${input.hrv} ms`);
  if (input.rhr != null) whyParts.push(`FC repouso ${input.rhr} bpm`);
  const why = `Base do cálculo: ${whyParts.join(' · ')}. Isso gera o score de prontidão (0–100).`;

  return { score, status, summary, decision, why, metrics };
}