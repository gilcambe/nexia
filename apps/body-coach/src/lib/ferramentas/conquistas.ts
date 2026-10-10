// Conquistas, níveis e XP: calculados dos dados que o app já guarda (treinos, refeições,
// check-ins e evolução). Nada é gravado: é só conta, então não gasta a cota grátis do banco.

export interface TreinoFeito {
  done_at?: string;
  duration_min?: number;
  sets?: number;
  volume_kg?: number;
  melhores?: Record<string, { weight: number; reps: number }>;
  cardio?: { tipo?: string; minutos?: number; km?: number | null }[];
}

export interface Dados {
  treinos: TreinoFeito[];
  refeicoes: number;
  checkins: number;
  avaliacoes: number;
  agora?: Date;
}

export interface Conquista {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  categoria: 'Treino' | 'Constância' | 'Força' | 'Cardio' | 'Nutrição' | 'Evolução';
  atual: number;
  meta: number;
  ok: boolean;
  xp: number;
}

const DIA = 86400000;
function diaDe(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function inicioSemana(d: Date): number {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.getTime();
}

// Maior sequência de dias seguidos com treino e a sequência atual (hoje ou ontem contam).
export function sequencias(datas: Date[], agora = new Date()): { atual: number; maior: number; semanasMeta: number } {
  const dias = [...new Set(datas.map(diaDe))].sort((a, b) => a - b);
  let maior = 0, run = 0, prev = -Infinity;
  for (const d of dias) {
    run = Math.round((d - prev) / DIA) === 1 ? run + 1 : 1;
    maior = Math.max(maior, run);
    prev = d;
  }
  const hoje = diaDe(agora);
  let atual = 0;
  const set = new Set(dias);
  let cursor = set.has(hoje) ? hoje : hoje - DIA;
  while (set.has(cursor)) { atual++; cursor -= DIA; }
  // Semanas seguidas com 3+ treinos (a semana atual em andamento não quebra).
  const porSemana = new Map<number, number>();
  for (const d of datas) porSemana.set(inicioSemana(d), (porSemana.get(inicioSemana(d)) ?? 0) + 1);
  const semAtual = inicioSemana(agora);
  let semanasMeta = (porSemana.get(semAtual) ?? 0) >= 3 ? 1 : 0;
  for (let s = semAtual - 7 * DIA; (porSemana.get(s) ?? 0) >= 3; s -= 7 * DIA) semanasMeta++;
  return { atual, maior, semanasMeta };
}

export function calcularConquistas(dados: Dados): Conquista[] {
  const agora = dados.agora ?? new Date();
  const treinos = dados.treinos.filter((t) => t.done_at && !isNaN(new Date(t.done_at).getTime()));
  const datas = treinos.map((t) => new Date(t.done_at as string));
  const total = treinos.length;
  const seq = sequencias(datas, agora);
  const volume = treinos.reduce((s, t) => s + (Number(t.volume_kg) || 0), 0);
  const minutos = treinos.reduce((s, t) => s + (Number(t.duration_min) || 0), 0);
  const km = treinos.reduce((s, t) => s + (t.cardio ?? []).reduce((a, c) => a + (Number(c.km) || 0), 0), 0);
  const maiorCarga = treinos.reduce((m, t) => Math.max(m, ...Object.values(t.melhores ?? {}).map((x) => Number(x.weight) || 0)), 0);
  const madrugador = datas.filter((d) => d.getHours() < 7).length;
  const fds = datas.filter((d) => d.getDay() === 0 || d.getDay() === 6).length;

  const lista: Omit<Conquista, 'ok'>[] = [
    { id: 't1', nome: 'Primeiro passo', descricao: 'Concluir o 1º treino', icone: 'ri-flag-line', categoria: 'Treino', atual: total, meta: 1, xp: 50 },
    { id: 't10', nome: 'Pegando o ritmo', descricao: '10 treinos concluídos', icone: 'ri-fire-line', categoria: 'Treino', atual: total, meta: 10, xp: 100 },
    { id: 't25', nome: 'Rotina de atleta', descricao: '25 treinos concluídos', icone: 'ri-run-line', categoria: 'Treino', atual: total, meta: 25, xp: 200 },
    { id: 't50', nome: 'Meio centenário', descricao: '50 treinos concluídos', icone: 'ri-medal-line', categoria: 'Treino', atual: total, meta: 50, xp: 400 },
    { id: 't100', nome: 'Clube dos 100', descricao: '100 treinos concluídos', icone: 'ri-trophy-line', categoria: 'Treino', atual: total, meta: 100, xp: 800 },
    { id: 'h10', nome: '10 horas de suor', descricao: 'Somar 10 horas treinando', icone: 'ri-time-line', categoria: 'Treino', atual: Math.floor(minutos / 60), meta: 10, xp: 150 },
    { id: 'cedo', nome: 'Madrugador', descricao: '5 treinos antes das 7h', icone: 'ri-sun-foggy-line', categoria: 'Treino', atual: madrugador, meta: 5, xp: 100 },
    { id: 'fds', nome: 'Sem folga no fim de semana', descricao: '8 treinos em sábados ou domingos', icone: 'ri-calendar-event-line', categoria: 'Treino', atual: fds, meta: 8, xp: 100 },
    { id: 's3', nome: '3 dias seguidos', descricao: 'Treinar 3 dias em sequência', icone: 'ri-flashlight-line', categoria: 'Constância', atual: seq.maior, meta: 3, xp: 80 },
    { id: 's7', nome: 'Semana perfeita', descricao: 'Treinar 7 dias em sequência', icone: 'ri-calendar-check-line', categoria: 'Constância', atual: seq.maior, meta: 7, xp: 250 },
    { id: 'w2', nome: 'Duas semanas firmes', descricao: '2 semanas seguidas com 3+ treinos', icone: 'ri-shield-star-line', categoria: 'Constância', atual: seq.semanasMeta, meta: 2, xp: 120 },
    { id: 'w4', nome: 'Um mês de foco', descricao: '4 semanas seguidas com 3+ treinos', icone: 'ri-vip-crown-line', categoria: 'Constância', atual: seq.semanasMeta, meta: 4, xp: 300 },
    { id: 'w12', nome: 'Hábito criado', descricao: '12 semanas seguidas com 3+ treinos', icone: 'ri-vip-diamond-line', categoria: 'Constância', atual: seq.semanasMeta, meta: 12, xp: 1000 },
    { id: 'v10', nome: '10 toneladas', descricao: 'Somar 10.000 kg levantados', icone: 'ri-scales-3-line', categoria: 'Força', atual: Math.floor(volume), meta: 10000, xp: 150 },
    { id: 'v100', nome: '100 toneladas', descricao: 'Somar 100.000 kg levantados', icone: 'ri-building-line', categoria: 'Força', atual: Math.floor(volume), meta: 100000, xp: 600 },
    { id: 'c100', nome: 'Três dígitos', descricao: 'Levantar 100 kg num exercício', icone: 'ri-boxing-line', categoria: 'Força', atual: maiorCarga, meta: 100, xp: 300 },
    { id: 'k5', nome: 'Primeiros 5 km', descricao: 'Somar 5 km de cardio', icone: 'ri-footprint-line', categoria: 'Cardio', atual: Math.floor(km * 10) / 10, meta: 5, xp: 80 },
    { id: 'k42', nome: 'Uma maratona', descricao: 'Somar 42 km de cardio', icone: 'ri-road-map-line', categoria: 'Cardio', atual: Math.floor(km * 10) / 10, meta: 42, xp: 300 },
    { id: 'k100', nome: 'Cem quilômetros', descricao: 'Somar 100 km de cardio', icone: 'ri-earth-line', categoria: 'Cardio', atual: Math.floor(km * 10) / 10, meta: 100, xp: 600 },
    { id: 'r10', nome: 'Diário em dia', descricao: 'Registrar 10 refeições', icone: 'ri-restaurant-line', categoria: 'Nutrição', atual: dados.refeicoes, meta: 10, xp: 80 },
    { id: 'r100', nome: 'Mestre da dieta', descricao: 'Registrar 100 refeições', icone: 'ri-bowl-line', categoria: 'Nutrição', atual: dados.refeicoes, meta: 100, xp: 400 },
    { id: 'ck7', nome: 'Conhece o próprio corpo', descricao: '7 check-ins do dia', icone: 'ri-heart-pulse-line', categoria: 'Evolução', atual: dados.checkins, meta: 7, xp: 80 },
    { id: 'ck30', nome: 'Atleta consciente', descricao: '30 check-ins do dia', icone: 'ri-pulse-line', categoria: 'Evolução', atual: dados.checkins, meta: 30, xp: 300 },
    { id: 'av1', nome: 'Ponto de partida', descricao: 'Registrar a 1ª avaliação ou medida', icone: 'ri-ruler-line', categoria: 'Evolução', atual: dados.avaliacoes, meta: 1, xp: 60 },
    { id: 'av4', nome: 'Evolução documentada', descricao: 'Registrar 4 avaliações', icone: 'ri-line-chart-line', categoria: 'Evolução', atual: dados.avaliacoes, meta: 4, xp: 250 },
  ];
  return lista.map((c) => ({ ...c, ok: c.atual >= c.meta }));
}

// Níveis: cada nível pede um pouco mais de XP que o anterior. Treino feito também vale XP.
export const NOMES_NIVEL = ['Iniciante', 'Aprendiz', 'Dedicado', 'Focado', 'Atleta', 'Avançado', 'Elite', 'Lenda'];
export function nivel(conquistas: Conquista[], treinos: number, refeicoes: number, checkins: number): { xp: number; nivel: number; nome: string; noNivel: number; proximo: number } {
  const xp = conquistas.filter((c) => c.ok).reduce((s, c) => s + c.xp, 0) + treinos * 20 + refeicoes * 2 + checkins * 5;
  let n = 1, piso = 0, passo = 200;
  while (xp >= piso + passo) { piso += passo; n++; passo = Math.round(passo * 1.35); }
  const nome = NOMES_NIVEL[Math.min(NOMES_NIVEL.length - 1, Math.floor((n - 1) / 2))];
  return { xp, nivel: n, nome, noNivel: xp - piso, proximo: passo };
}

// "Nunca falhe duas vezes": quantos dias desde o último treino.
export function diasSemTreinar(datas: Date[], agora = new Date()): number | null {
  if (!datas.length) return null;
  const ultimo = Math.max(...datas.map(diaDe));
  return Math.round((diaDe(agora) - ultimo) / DIA);
}
