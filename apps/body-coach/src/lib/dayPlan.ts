// Treino do dia personalizado: junta o que o aluno respondeu no cadastro (nível, lesões, objetivo),
// a divisão e a ênfase que ele escolheu e como ele está HOJE (sono, comida, dor, tempo, equipamento).
import type { Exercise, Session } from '@/mocks/workout';
import { EXERCICIOS, POR_ID, lesoesDoTexto, permitido, demoDoExercicio, type Exercicio, type Grupo, type Lesao } from './exerciseDb';

export type Divisao = 'abc' | 'abcd' | 'ppl' | 'upper_lower' | 'fullbody';
export const DIVISOES: Record<Divisao, { nome: string; dias: { titulo: string; grupos: Grupo[] }[] }> = {
  abc: { nome: 'ABC', dias: [
    { titulo: 'A · Peito, ombros e tríceps', grupos: ['peito', 'ombros', 'triceps'] },
    { titulo: 'B · Costas, bíceps e abdômen', grupos: ['costas', 'biceps', 'abdomen'] },
    { titulo: 'C · Pernas', grupos: ['quadriceps', 'posterior', 'gluteos', 'panturrilha'] },
  ] },
  abcd: { nome: 'ABCD', dias: [
    { titulo: 'A · Peito e tríceps', grupos: ['peito', 'triceps'] },
    { titulo: 'B · Costas e bíceps', grupos: ['costas', 'biceps'] },
    { titulo: 'C · Pernas', grupos: ['quadriceps', 'posterior', 'gluteos', 'panturrilha'] },
    { titulo: 'D · Ombros e abdômen', grupos: ['ombros', 'abdomen'] },
  ] },
  ppl: { nome: 'Push / Pull / Legs', dias: [
    { titulo: 'Push · Peito, ombros e tríceps', grupos: ['peito', 'ombros', 'triceps'] },
    { titulo: 'Pull · Costas e bíceps', grupos: ['costas', 'biceps'] },
    { titulo: 'Legs · Pernas', grupos: ['quadriceps', 'posterior', 'gluteos', 'panturrilha'] },
  ] },
  upper_lower: { nome: 'Superior / Inferior', dias: [
    { titulo: 'Superior', grupos: ['peito', 'costas', 'ombros', 'biceps', 'triceps'] },
    { titulo: 'Inferior', grupos: ['quadriceps', 'posterior', 'gluteos', 'panturrilha', 'abdomen'] },
  ] },
  fullbody: { nome: 'Corpo inteiro', dias: [
    { titulo: 'Corpo inteiro', grupos: ['quadriceps', 'peito', 'costas', 'ombros', 'posterior', 'abdomen'] },
  ] },
};

// Sugestão inicial pela quantidade de dias por semana que o aluno informou.
export function divisaoSugerida(diasPorSemana: number): Divisao {
  if (diasPorSemana <= 2) return 'fullbody';
  if (diasPorSemana === 3) return 'abc';
  if (diasPorSemana === 4) return 'upper_lower';
  return 'abcd';
}

export interface EstadoDoDia {
  sono: 'bom' | 'regular' | 'ruim';
  alimentacao: 'comi_bem' | 'comi_pouco' | 'jejum';
  energia: 1 | 2 | 3 | 4 | 5;
  tempoMin: number;
  dores: string; // texto livre: onde dói hoje
  indisponiveis: string[]; // ids de exercícios que não dá para fazer hoje
}

export interface EntradaDoDia {
  respostas: Record<string, unknown>; // respostas do questionário
  divisao: Divisao;
  diaDaDivisao: number; // índice do dia dentro da divisão
  enfase: Grupo[]; // grupos que o aluno quer priorizar
  estado: EstadoDoDia;
  variacao: number; // muda a escolha dos exercícios de uma sessão para outra
}

export interface TreinoDoDia { sessao: Session; avisos: string[]; lesoes: Lesao[] }

function dose(nivel: unknown, objetivo?: unknown) {
  let d = { series: 3, reps: '8–12', rir: 2, descanso: 120 };
  if (nivel === 'Iniciante') d = { series: 3, reps: '10–12', rir: 3, descanso: 90 };
  else if (nivel === 'Avançado' || nivel === 'Alto desempenho') d = { series: 4, reps: '6–10', rir: 1, descanso: 150 };
  // O objetivo muda a faixa de repetições e o descanso.
  if (objetivo === 'Força' || objetivo === 'Performance' || objetivo === 'Competição') d = { ...d, reps: '4–6', rir: Math.max(d.rir, 2), descanso: 180 };
  else if (objetivo === 'Perda de gordura' || objetivo === 'Condicionamento') d = { ...d, reps: '12–15', descanso: 60 };
  else if (objetivo === 'Saúde' || objetivo === 'Recuperação') d = { ...d, reps: '10–15', rir: Math.max(d.rir, 3), descanso: 90 };
  return d;
}

// Limitações de mobilidade do aluno (perfil) e o que cada uma exclui do treino.
const NAO_SENTADO = /agachamento|levantamento terra|stiff|afundo|barra fixa|flexão|mergulho|remada curvada|prancha|elevação de pernas|dead bug|goblet|sumô|coice|elevação pélvica|panturrilha em pé|face pull/i;
const GRUPOS_SUPERIORES: Grupo[] = ['peito', 'costas', 'ombros', 'biceps', 'triceps', 'abdomen'];
const DICAS_MODALIDADE: Record<string, string> = {
  Corrida: 'Seu foco inclui corrida: depois do treino de força, 20 a 30 min de corrida leve (ritmo de conversa) em dias alternados.',
  Natação: 'Seu foco inclui natação: priorize costas, ombros e core, e mobilidade de ombro no aquecimento.',
  Lutas: 'Seu foco inclui lutas: priorize core, pescoço, ombros e condicionamento; evite treinar pesado no dia anterior ao treino técnico.',
  Ciclismo: 'Seu foco inclui ciclismo: força de pernas e core ajudam; mantenha os pedais leves em dias de perna pesada.',
};

const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function montarTreinoDoDia(e: EntradaDoDia): TreinoDoDia {
  const dias = DIVISOES[e.divisao].dias;
  const dia = dias[((e.diaDaDivisao % dias.length) + dias.length) % dias.length];
  const lesoes = lesoesDoTexto(e.respostas.injuries, e.respostas.symptoms, e.respostas.history, e.estado.dores);
  const base = dose(e.respostas.level, e.respostas.goal);
  const mob = Array.isArray(e.respostas.mobility) ? (e.respostas.mobility as string[]) : [];
  const cadeirante = mob.includes('Cadeirante');
  const idoso = mob.includes('60 anos ou mais');
  const gestante = mob.includes('Gestante');
  const mobReduzida = mob.includes('Mobilidade reduzida (muleta ou andador)');
  const avisos: string[] = [];

  // Ajuste pelo estado de hoje.
  let series = base.series;
  let rir = base.rir;
  let corte = 0;
  const cansado = e.estado.sono === 'ruim' || e.estado.energia <= 2;
  if (cansado) { series = Math.max(2, series - 1); rir += 1; avisos.push('Você dormiu mal ou está sem energia: reduzi uma série por exercício e deixei mais reserva (RIR +1).'); }
  if (e.estado.alimentacao === 'jejum') { rir += 1; corte += 1; avisos.push('Treino em jejum: tirei um exercício, deixei a carga mais folgada e vale comer carboidrato e proteína logo depois.'); }
  else if (e.estado.alimentacao === 'comi_pouco') { rir += 1; avisos.push('Você comeu pouco: mantenha a carga confortável e coma algo leve antes de começar.'); }
  if (idoso || mobReduzida) { rir += 1; avisos.push('Treino mais leve e com descanso maior, para proteger articulações e equilíbrio. Use apoio quando precisar.'); }
  if (gestante) avisos.push('Gestante: sem exercícios de abdômen nem terra hoje. Combine o treino com a sua médica ou médico.');
  if (cadeirante) avisos.push('Treino adaptado para cadeirante: só exercícios feitos sentado, sem pernas em pé, esteira ou impacto.');
  for (const m of (Array.isArray(e.respostas.modality) ? (e.respostas.modality as string[]) : [])) if (DICAS_MODALIDADE[m] && !cadeirante) avisos.push(DICAS_MODALIDADE[m]);
  if (lesoes.size) avisos.push(`Evitei exercícios que sobrecarregam: ${[...lesoes].join(', ')}. Se doer durante o movimento, pare e avise o coach.`);

  // Quantos exercícios cabem no tempo (cerca de 9 minutos cada, com descanso).
  const maxExercicios = Math.max(3, Math.floor(e.estado.tempoMin / 9) - corte);

  // Escolha por grupo: compostos primeiro, ênfase ganha um exercício a mais.
  const escolhidos: Exercicio[] = [];
  let grupos = dia.grupos;
  let tituloDia = dia.titulo;
  if (cadeirante) {
    grupos = grupos.filter((g) => GRUPOS_SUPERIORES.includes(g));
    if (!grupos.length) { grupos = ['costas', 'ombros', 'abdomen']; avisos.push('Dia de pernas trocado por costas, ombros e core sentado.'); tituloDia = 'Costas, ombros e core (sentado)'; }
  }
  if (gestante) grupos = grupos.filter((g) => g !== 'abdomen');
  for (const g of grupos) {
    const opcoes = EXERCICIOS.filter((x) => x.grupo === g && permitido(x, lesoes, e.estado.indisponiveis) && !(cadeirante && (NAO_SENTADO.test(x.nome) || x.equip === 'smith')) && !(gestante && /levantamento terra|stiff/i.test(x.nome)));
    if (!opcoes.length) { avisos.push(`Sem opção segura para ${g} hoje com suas limitações; pulei esse grupo.`); continue; }
    const compostos = opcoes.filter((x) => x.composto);
    const isolados = opcoes.filter((x) => !x.composto);
    const quantos = e.enfase.includes(g) ? 3 : g === 'panturrilha' || g === 'abdomen' || g === 'biceps' || g === 'triceps' ? 1 : 2;
    const ordem = [...compostos.slice(e.variacao % Math.max(compostos.length, 1)), ...compostos.slice(0, e.variacao % Math.max(compostos.length, 1)),
      ...isolados.slice(e.variacao % Math.max(isolados.length, 1)), ...isolados.slice(0, e.variacao % Math.max(isolados.length, 1))];
    escolhidos.push(...ordem.slice(0, quantos));
  }
  if (e.enfase.length) avisos.push(`Dei prioridade a: ${e.enfase.join(', ')}.`);

  // Compostos antes dos isolados; corta o excesso pelo tempo (a ênfase é a última a sair).
  escolhidos.sort((a, b) => Number(b.composto) - Number(a.composto));
  const lista = escolhidos.slice(0, maxExercicios);
  if (lista.length < escolhidos.length) avisos.push(`Com ${e.estado.tempoMin} min, deixei ${lista.length} exercícios.`);

  const exercicios: Exercise[] = lista.map((x) => ({
    id: x.id,
    name: x.nome,
    muscleGroup: x.grupo,
    targetReps: x.composto ? base.reps : '12–15',
    targetSets: x.composto ? series : Math.max(2, series),
    restSec: (x.composto ? base.descanso : 75) + (idoso || mobReduzida ? 30 : 0),
    note: `Alvo RIR ${rir}.`,
    videoUrl: demoDoExercicio(x.id)?.[0] ?? '',
    minWeight: 0,
    maxWeight: 300,
    weightUnit: 'kg',
    prevSession: { date: 'Sem registro anterior', sets: [] },
    sets: [],
  }));

  const aquecimento = [
    { name: cadeirante ? 'Aquecimento de ombros, punhos e braços (rotações e elásticos)' : 'Aquecimento leve (bike ou esteira)', durationSec: 300 },
    { name: 'Mobilidade articular', durationSec: 180 },
    ...[...lesoes].map((l) => ({ name: `Mobilidade e ativação leve: ${l}`, durationSec: 120 })),
  ];

  return {
    lesoes: [...lesoes],
    avisos,
    sessao: {
      id: `sess-${e.divisao}-${e.diaDaDivisao}-${hoje()}`,
      title: tituloDia,
      objective: tituloDia,
      estimatedMinutes: Math.min(e.estado.tempoMin, lista.length * 9 + 8),
      priority: cansado ? 'baixa' : 'media',
      type: 'forca',
      date: 'Hoje',
      warmup: aquecimento,
      exercises: exercicios,
    },
  };
}

// Troca um exercício do treino já montado por outro do mesmo grupo (equipamento ocupado, quebrado ou ausente).
export function trocarExercicio(s: Session, idAtual: string, idNovo: string): Session {
  const novo = POR_ID[idNovo];
  if (!novo) return s;
  return {
    ...s,
    exercises: s.exercises.map((x) => (x.id === idAtual
      ? { ...x, id: novo.id, name: novo.nome, muscleGroup: novo.grupo, videoUrl: demoDoExercicio(novo.id)?.[0] ?? '', note: x.note.split(' Vídeo:')[0], sets: [] }
      : x)),
  };
}
