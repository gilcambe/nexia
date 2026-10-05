export interface MarkerDef {
  key: string;
  label: string;
  unit: string;
  low: number;
  high: number;
  lowMsg: string;
  normalMsg: string;
  highMsg: string;
  lowSuggestion: string;
  highSuggestion: string;
}

export interface MarkerResult {
  status: 'low' | 'normal' | 'high';
  label: string;
  value: number;
  unit: string;
  message: string;
  suggestion: string;
}

export const markers: MarkerDef[] = [
  {
    key: 'vitamina_d',
    label: 'Vitamina D (25-OH)',
    unit: 'ng/mL',
    low: 20,
    high: 100,
    lowMsg: 'Deficiência de vitamina D.',
    normalMsg: 'Vitamina D em nível adequado.',
    highMsg: 'Vitamina D acima do ideal (toxicidade em níveis muito altos).',
    lowSuggestion: 'Suplementar vitamina D3 (ex.: 2.000–4.000 UI/dia) com exposição solar. Reavalie em 8–12 semanas.',
    highSuggestion: 'Suspenda suplementação de vitamina D e reavalie com médico.',
  },
  {
    key: 'ferritina',
    label: 'Ferritina (estoque de ferro)',
    unit: 'ng/mL',
    low: 30,
    high: 300,
    lowMsg: 'Estoque de ferro baixo.',
    normalMsg: 'Ferro em nível adequado.',
    highMsg: 'Ferritina elevada (pode indicar inflamação ou sobrecarga de ferro).',
    lowSuggestion: 'Avalie suplementação de ferro + vitamina C. Aumente carnes vermelhas e folhas verdes. Confirme com médico.',
    highSuggestion: 'Investigue causa com médico antes de qualquer suplementação de ferro.',
  },
  {
    key: 'testosterona',
    label: 'Testosterona total',
    unit: 'ng/dL',
    low: 300,
    high: 1000,
    lowMsg: 'Testosterona abaixo da referência.',
    normalMsg: 'Testosterona em nível saudável.',
    highMsg: 'Testosterona acima da referência.',
    lowSuggestion: 'Priorize sono (7–9h), reduza estresse, controle gordura corporal e mantenha treino de força. Endócrino pode avaliar.',
    highSuggestion: 'Reavalie com médico para investigar causa.',
  },
  {
    key: 'tsh',
    label: 'TSH (tireoide)',
    unit: 'mUI/L',
    low: 0.4,
    high: 4.5,
    lowMsg: 'TSH baixo (sugere hipertireoidismo).',
    normalMsg: 'Função da tireoide normal.',
    highMsg: 'TSH alto (sugere hipotireoidismo).',
    lowSuggestion: 'Encaminhar ao endocrinologista para avaliação completa.',
    highSuggestion: 'Encaminhar ao endocrinologista para avaliação completa.',
  },
  {
    key: 'hemoglobina',
    label: 'Hemoglobina',
    unit: 'g/dL',
    low: 13.5,
    high: 17.5,
    lowMsg: 'Hemoglobina baixa (possível anemia).',
    normalMsg: 'Hemoglobina em nível adequado.',
    highMsg: 'Hemoglobina elevada (comum em atletas de altitude, mas avalie).',
    lowSuggestion: 'Investigue ferro e B12. Aumente alimentos ricos em ferro e folato. Confirme com médico.',
    highSuggestion: 'Avalie hidratação e, se persistir, investigue com médico.',
  },
  {
    key: 'cortisol',
    label: 'Cortisol matinal',
    unit: 'µg/dL',
    low: 6,
    high: 23,
    lowMsg: 'Cortisol baixo pela manhã.',
    normalMsg: 'Cortisol em faixa saudável.',
    highMsg: 'Cortisol elevado (estresse ou sobrecarga).',
    lowSuggestion: 'Avalie ritmo de sono e recuperação. Consulte médico se houver fadiga persistente.',
    highSuggestion: 'Reduza volume de treino, priorize sono e estratégias de recuperação. Monitore.',
  },
];

export function interpretMarker(key: string, value: number): MarkerResult | null {
  const def = markers.find((m) => m.key === key);
  if (!def) return null;

  let status: 'low' | 'normal' | 'high';
  if (value < def.low) status = 'low';
  else if (value > def.high) status = 'high';
  else status = 'normal';

  const message = status === 'low' ? def.lowMsg : status === 'high' ? def.highMsg : def.normalMsg;
  const suggestion = status === 'low' ? def.lowSuggestion : status === 'high' ? def.highSuggestion : 'Mantenha os hábitos atuais.';

  return { status, label: def.label, value, unit: def.unit, message, suggestion };
}

export const examTypes = ['Sangue', 'Raio-X', 'Ressonância', 'Ultrassom', 'Laudo médico', 'Outro'];