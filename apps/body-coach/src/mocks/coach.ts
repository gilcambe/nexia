export interface CoachMessage {
  id: string;
  speaker: 'coach' | 'user';
  text: string;
  time: string;
}

export interface WhyEntry {
  id: string;
  change: string;
  reason: string;
  source: string;
  validity: string;
}

export interface Specialist {
  id: string;
  name: string;
  role: string;
  active: boolean;
  reason: string;
}

export const whyEngine: WhyEntry[] = [
  {
    id: 'w1',
    change: 'Remada curvada → remada com apoio no peito',
    reason: 'Preservar a lombar diante da fadiga atual.',
    source: 'check-in + histórico',
    validity: 'Sessão atual; reavaliar depois.',
  },
  {
    id: 'w2',
    change: 'Volume reduzido 20% no leg press',
    reason: 'Recuperação ~18% abaixo da sua linha normal.',
    source: 'check-in + HRV (wearable)',
    validity: 'Sessão atual; reavaliar no próximo check-in.',
  },
];

export const specialists: Specialist[] = [
  { id: 's1', name: 'Performance Director', role: 'Motor de decisão', active: true, reason: 'Prioriza a sessão do dia' },
  { id: 's2', name: 'Head Coach', role: 'Motor de treino', active: true, reason: 'Executa o treino de força' },
  { id: 's3', name: 'Sports Scientist', role: 'Carga e adaptação', active: true, reason: 'Recuperação abaixo da linha' },
  { id: 's4', name: 'Sports Medicine', role: 'Camada de segurança', active: true, reason: 'Monitora ombro direito' },
  { id: 's5', name: 'Performance Nutrition', role: 'Nutrição', active: true, reason: 'Meta de proteína pendente' },
  { id: 's6', name: 'Data / Performance Analyst', role: 'Analytics', active: false, reason: '' },
  { id: 's7', name: 'Mental Performance', role: 'Mente', active: false, reason: '' },
  { id: 's8', name: 'Biomechanics', role: 'Técnica', active: false, reason: '' },
];

export const coachSeed: CoachMessage[] = [
  { id: 'c1', speaker: 'coach', text: 'Bom dia, Rafael. Vi seu check-in: recuperação ~18% abaixo da linha (sono 6h20, HRV 12% abaixo, fadiga 7/10). Sem sinais de alerta, então hoje vamos treinar pernas, mas com 20% menos volume.', time: '07:04' },
  { id: 'c2', speaker: 'coach', text: 'Objetivo: manter estímulo sem acumular fadiga. Você começa pelo leg press — 4 séries de 12–15, RIR 2. Pode começar.', time: '07:04' },
];

export const coachResponses: Record<string, string> = {
  'quanto ainda posso comer': 'Você já consumiu 1.470 kcal / 111g proteína. Pode ingerir ~1.380 kcal até bater a meta de 2.850. Priorize ~70g de proteína e mantenha gordura moderada (cerca de 40g).',
  'estou muito cansado': 'Sua fadiga está 7/10 e a recuperação abaixo da linha. Não é motivo para cancelar — vamos rodar com 80% do volume e menor intensidade. Se a dor ou o cansaço subirem durante a série, você me avisa e encurtamos.',
  'dor no ombro': 'Sinal leve no ombro direito (1/10), já monitorado. Vamos evitar abdução com carga alta hoje. Se a dor piorar ou houver perda de movimento, paramos e encaminhamos para avaliação. Não é diagnóstico — é precaução.',
  'fiz 12 com 70': 'Registrado: 70 kg × 12 reps, RIR ~2. Ficou dentro do alvo. Mantenha a carga e busque 12–15 com RIR 2 na próxima série.',
  'as duas últimas ficaram difíceis': 'Entendido. Na última série do exercício, a técnica começou a cair — vou reduzir a carga ~5% na próxima e manter 12–15 com RIR 2. Execução acima do ego.',
};

export const coachGreetings = [
  'Diga o que você fez, como se sente, ou "quanto ainda posso comer". Eu sei o contexto da sua sessão.',
  'Pode falar: "fiz 12 com 70", "hoje está pesado", ou pedir a próxima série. Eu acompanho o treino.',
];