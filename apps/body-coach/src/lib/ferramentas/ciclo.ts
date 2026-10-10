// Ciclo menstrual no treino e na dieta (opcional, só para quem ativar).
// Usa a data do início da última menstruação e a duração média do ciclo.

export type Fase = 'menstrual' | 'folicular' | 'ovulatoria' | 'lutea';

export interface InfoFase {
  fase: Fase;
  nome: string;
  dia: number;
  duracao: number;
  proxima: Date;
  treino: string;
  nutricao: string;
  cor: string;
}

const DIA = 86400000;

export function faseDoCiclo(inicio: string, duracao = 28, agora = new Date()): InfoFase | null {
  const ini = new Date(inicio + 'T00:00:00');
  if (isNaN(ini.getTime())) return null;
  const dur = Math.min(45, Math.max(21, Math.round(duracao) || 28));
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
  const passados = Math.floor((hoje - ini.getTime()) / DIA);
  if (passados < 0) return null;
  const dia = (passados % dur) + 1;
  const proxima = new Date(ini.getTime() + (Math.floor(passados / dur) + 1) * dur * DIA);
  const ovulacao = dur - 14; // a fase lútea dura ~14 dias
  let fase: Fase;
  if (dia <= 5) fase = 'menstrual';
  else if (dia < ovulacao - 1) fase = 'folicular';
  else if (dia <= ovulacao + 1) fase = 'ovulatoria';
  else fase = 'lutea';
  const textos: Record<Fase, Omit<InfoFase, 'fase' | 'dia' | 'duracao' | 'proxima'>> = {
    menstrual: {
      nome: 'Menstrual',
      treino: 'Treine se estiver bem, ouvindo o corpo. Com cólica ou cansaço, prefira carga moderada, mobilidade e cardio leve.',
      nutricao: 'Capriche no ferro (feijão, carne vermelha, folhas escuras) e na água. Chá quente e magnésio ajudam nas cólicas.',
      cor: 'bg-rose-500',
    },
    folicular: {
      nome: 'Folicular',
      treino: 'Energia em alta: boa fase para subir carga, tentar recordes e treinos mais intensos.',
      nutricao: 'Ótima fase para carboidratos em volta do treino. Proteína em todas as refeições.',
      cor: 'bg-emerald-500',
    },
    ovulatoria: {
      nome: 'Ovulatória',
      treino: 'Força no pico. Aqueça bem: ligamentos ficam mais frouxos e o risco de lesão no joelho sobe um pouco.',
      nutricao: 'Mantenha a hidratação e fibras. Fome costuma ficar estável.',
      cor: 'bg-amber-500',
    },
    lutea: {
      nome: 'Lútea',
      treino: 'Temperatura e cansaço sobem. Mantenha o treino, mas aceite cargas um pouco menores e descanso maior.',
      nutricao: 'Fome maior é normal: some ~100–200 kcal com proteína e fibras. Reduza sal e cafeína se inchar.',
      cor: 'bg-violet-500',
    },
  };
  return { fase, dia, duracao: dur, proxima, ...textos[fase] };
}
