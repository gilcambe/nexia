// Calculadoras de treino: tudo é conta feita no próprio aparelho (grátis, funciona sem internet).

// 1RM estimado (média de Epley e Brzycki) e tabela de cargas por porcentagem.
export function umRM(carga: number, reps: number): number {
  if (!(carga > 0) || !(reps > 0)) return 0;
  if (reps === 1) return carga;
  const r = Math.min(reps, 15);
  const epley = carga * (1 + r / 30);
  const brzycki = carga * (36 / (37 - r));
  return Math.round(((epley + brzycki) / 2) * 10) / 10;
}

export const ZONAS_RM = [
  { pct: 95, reps: '1–2', uso: 'Força máxima' },
  { pct: 90, reps: '3–4', uso: 'Força' },
  { pct: 85, reps: '5–6', uso: 'Força' },
  { pct: 80, reps: '7–8', uso: 'Força e hipertrofia' },
  { pct: 75, reps: '9–10', uso: 'Hipertrofia' },
  { pct: 70, reps: '11–12', uso: 'Hipertrofia' },
  { pct: 65, reps: '13–15', uso: 'Resistência' },
  { pct: 60, reps: '15–20', uso: 'Resistência / técnica' },
];

// Anilhas para cada lado da barra (do maior para o menor).
export const ANILHAS_KG = [25, 20, 15, 10, 5, 2.5, 2, 1.25, 1];
export function anilhasPorLado(total: number, barra = 20, disponiveis: number[] = ANILHAS_KG): { lado: number[]; sobra: number } {
  let resto = Math.round(((total - barra) / 2) * 100) / 100;
  const lado: number[] = [];
  if (resto <= 0) return { lado, sobra: Math.max(0, resto) };
  for (const a of [...disponiveis].sort((x, y) => y - x)) {
    while (resto + 1e-9 >= a) {
      lado.push(a);
      resto = Math.round((resto - a) * 100) / 100;
    }
  }
  return { lado, sobra: resto };
}

// Zonas de frequência cardíaca: FC máxima de Tanaka (208 - 0,7 × idade) e, com a FC de repouso, Karvonen.
export function zonasFC(idade: number, repouso?: number): { zona: number; nome: string; de: number; ate: number; uso: string }[] {
  const max = Math.round(208 - 0.7 * idade);
  const r = repouso && repouso > 30 && repouso < 120 ? repouso : 0;
  const bpm = (p: number) => Math.round(r ? r + (max - r) * p : max * p);
  const faixas: [string, number, number, string][] = [
    ['Recuperação', 0.5, 0.6, 'Aquecimento, desaquecer, dia leve'],
    ['Base aeróbica', 0.6, 0.7, 'Queima de gordura, rodagem longa'],
    ['Aeróbico', 0.7, 0.8, 'Ritmo moderado, condicionamento'],
    ['Limiar', 0.8, 0.9, 'Ritmo forte, tiros longos'],
    ['Máximo', 0.9, 1, 'Tiros curtos, sprints'],
  ];
  return faixas.map(([nome, a, b, uso], i) => ({ zona: i + 1, nome, de: bpm(a), ate: bpm(b), uso }));
}

// Ritmo de corrida: min/km a partir de distância e tempo, e previsão de prova (Riegel).
export function ritmo(km: number, minutos: number): string {
  if (!(km > 0) || !(minutos > 0)) return '—';
  return formatarMin(minutos / km) + ' /km';
}
export function formatarMin(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return '—';
  const total = Math.round(min * 60);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}min${ss}s` : `${m}:${ss}`;
}
export function preverProva(kmFeito: number, minFeito: number, kmAlvo: number): number {
  if (!(kmFeito > 0) || !(minFeito > 0) || !(kmAlvo > 0)) return 0;
  return minFeito * Math.pow(kmAlvo / kmFeito, 1.06);
}

// Gasto calórico do dia (Mifflin-St Jeor × atividade).
export function gastoDiario(o: { peso: number; altura: number; idade: number; sexo: 'M' | 'F'; atividade: number }): { basal: number; total: number } {
  if (!(o.peso > 0) || !(o.altura > 0) || !(o.idade > 0)) return { basal: 0, total: 0 };
  const basal = 10 * o.peso + 6.25 * o.altura - 5 * o.idade + (o.sexo === 'M' ? 5 : -161);
  return { basal: Math.round(basal), total: Math.round(basal * o.atividade) };
}
export const NIVEIS_ATIVIDADE = [
  { valor: 1.2, nome: 'Parado (sem treino)' },
  { valor: 1.375, nome: 'Leve (1–3 treinos/semana)' },
  { valor: 1.55, nome: 'Moderado (3–5 treinos/semana)' },
  { valor: 1.725, nome: 'Alto (6–7 treinos/semana)' },
  { valor: 1.9, nome: 'Atleta (2 treinos/dia)' },
];

// Água do dia: 35 ml por kg + 500 ml por hora de treino.
export function aguaDia(peso: number, horasTreino = 1): number {
  if (!(peso > 0)) return 0;
  return Math.round((peso * 35 + horasTreino * 500) / 50) * 50;
}
