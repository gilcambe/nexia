// Modo viagem: monta um treino para o quarto do hotel, o parque ou a academia do hotel,
// com o tempo que o aluno tem e o equipamento que achou. Silencioso = sem saltos (vizinhos agradecem).
import type { Bloco, TreinoPronto } from './treinosProntos';

export type Equipamento = 'nada' | 'elastico' | 'halteres' | 'academia';
export interface OpcoesViagem { minutos: number; equipamento: Equipamento; silencioso: boolean; foco: 'corpo' | 'pernas' | 'superior' | 'cardio'; nivel: 'Iniciante' | 'Intermediário' | 'Avançado' }

interface Ex { nome: string; dica: string; grupo: 'pernas' | 'superior' | 'core' | 'cardio'; salto?: boolean; equip?: Equipamento[] }

const EXS: Ex[] = [
  { nome: 'Agachamento livre', dica: 'Quadril para trás, joelhos na linha dos pés.', grupo: 'pernas' },
  { nome: 'Afundo alternado', dica: 'Joelho de trás quase no chão, tronco firme.', grupo: 'pernas' },
  { nome: 'Agachamento búlgaro (pé na cama)', dica: 'Pé de trás apoiado na cama ou cadeira.', grupo: 'pernas' },
  { nome: 'Ponte de glúteo', dica: 'Suba o quadril e aperte o glúteo 1 segundo.', grupo: 'pernas' },
  { nome: 'Cadeira isométrica na parede', dica: 'Coxas paralelas ao chão, costas na parede.', grupo: 'pernas' },
  { nome: 'Panturrilha em um pé', dica: 'Segure na parede e suba devagar.', grupo: 'pernas' },
  { nome: 'Flexão de braço', dica: 'Pode apoiar os joelhos. Corpo reto como prancha.', grupo: 'superior' },
  { nome: 'Flexão inclinada na cama', dica: 'Mãos na beira da cama, mais fácil e segura.', grupo: 'superior' },
  { nome: 'Tríceps no banco (cadeira)', dica: 'Mãos na cadeira firme, desça até 90 graus.', grupo: 'superior' },
  { nome: 'Remada na toalha (porta)', dica: 'Toalha presa na maçaneta, puxe o corpo.', grupo: 'superior' },
  { nome: 'Flexão pike (ombros)', dica: 'Quadril alto, cabeça desce entre as mãos.', grupo: 'superior' },
  { nome: 'Prancha', dica: 'Cotovelos sob os ombros, abdômen firme.', grupo: 'core' },
  { nome: 'Prancha lateral', dica: 'Quadril alto. Troque o lado na metade.', grupo: 'core' },
  { nome: 'Abdominal bicicleta', dica: 'Cotovelo em direção ao joelho oposto, devagar.', grupo: 'core' },
  { nome: 'Perdigueiro', dica: 'Braço e perna opostos, sem girar o quadril.', grupo: 'core' },
  { nome: 'Escalador lento', dica: 'Joelho ao peito, sem pular.', grupo: 'cardio' },
  { nome: 'Marcha alta no lugar', dica: 'Joelhos na altura do quadril, braços ativos.', grupo: 'cardio' },
  { nome: 'Burpee sem salto', dica: 'Desça, estenda as pernas, volte e fique em pé.', grupo: 'cardio' },
  { nome: 'Polichinelo', dica: 'Ritmo constante.', grupo: 'cardio', salto: true },
  { nome: 'Agachamento com salto', dica: 'Aterrisse macio, joelhos para fora.', grupo: 'cardio', salto: true },
  { nome: 'Burpee', dica: 'No seu ritmo, sem perder a técnica.', grupo: 'cardio', salto: true },
  { nome: 'Corrida estacionária', dica: 'Joelhos altos, na ponta dos pés.', grupo: 'cardio', salto: true },
  { nome: 'Remada com elástico', dica: 'Pise no elástico e puxe até a cintura.', grupo: 'superior', equip: ['elastico'] },
  { nome: 'Desenvolvimento com elástico', dica: 'Empurre acima da cabeça sem arquear as costas.', grupo: 'superior', equip: ['elastico'] },
  { nome: 'Agachamento com elástico', dica: 'Elástico sob os pés e nas mãos, na altura dos ombros.', grupo: 'pernas', equip: ['elastico'] },
  { nome: 'Abdução com elástico', dica: 'Elástico acima dos joelhos, passos laterais.', grupo: 'pernas', equip: ['elastico'] },
  { nome: 'Agachamento goblet com halter', dica: 'Halter junto ao peito.', grupo: 'pernas', equip: ['halteres', 'academia'] },
  { nome: 'Stiff com halteres', dica: 'Costas retas, halteres perto das pernas.', grupo: 'pernas', equip: ['halteres', 'academia'] },
  { nome: 'Remada unilateral com halter', dica: 'Mão e joelho apoiados no banco ou cama.', grupo: 'superior', equip: ['halteres', 'academia'] },
  { nome: 'Supino com halteres no chão', dica: 'Cotovelos a 45 graus do corpo.', grupo: 'superior', equip: ['halteres', 'academia'] },
  { nome: 'Desenvolvimento com halteres', dica: 'Sentado, sem arquear a lombar.', grupo: 'superior', equip: ['halteres', 'academia'] },
  { nome: 'Esteira inclinada', dica: 'Inclinação 8–12%, passo firme, sem segurar.', grupo: 'cardio', equip: ['academia'] },
  { nome: 'Bike em ritmo forte', dica: 'Carga que deixe falar só frases curtas.', grupo: 'cardio', equip: ['academia'] },
];

const RITMO: Record<OpcoesViagem['nivel'], { trabalho: number; descanso: number }> = {
  Iniciante: { trabalho: 30, descanso: 30 },
  Intermediário: { trabalho: 40, descanso: 20 },
  Avançado: { trabalho: 45, descanso: 15 },
};

const PESO_FOCO: Record<OpcoesViagem['foco'], Ex['grupo'][]> = {
  corpo: ['pernas', 'superior', 'core', 'cardio', 'pernas', 'superior'],
  pernas: ['pernas', 'pernas', 'core', 'pernas', 'cardio', 'pernas'],
  superior: ['superior', 'superior', 'core', 'superior', 'cardio', 'superior'],
  cardio: ['cardio', 'pernas', 'cardio', 'core', 'cardio', 'superior'],
};

export function exerciciosPossiveis(o: Pick<OpcoesViagem, 'equipamento' | 'silencioso'>): Ex[] {
  return EXS.filter((e) => (!e.salto || !o.silencioso) && (!e.equip || e.equip.includes(o.equipamento) || (o.equipamento === 'academia' && e.equip.includes('halteres'))));
}

export function montarTreinoViagem(o: OpcoesViagem): TreinoPronto {
  const r = RITMO[o.nivel];
  const pool = exerciciosPossiveis(o);
  // prefere os exercícios com o equipamento escolhido
  const ordenar = (lista: Ex[]) => [...lista].sort((a, b) => Number(!!b.equip) - Number(!!a.equip));
  const usados = new Set<string>();
  const escolher = (g: Ex['grupo']) => {
    const op = ordenar(pool.filter((e) => e.grupo === g && !usados.has(e.nome)));
    const e = op[0] ?? pool.find((x) => !usados.has(x.nome)) ?? pool[0];
    usados.add(e.nome);
    return e;
  };
  const exs = PESO_FOCO[o.foco].map(escolher);
  const aquec: Bloco[] = [
    { nome: 'Marcha no lugar', seg: 45, dica: 'Aquecendo: braços acompanhando.' },
    { nome: 'Rotação de ombros e quadril', seg: 45, dica: 'Movimentos amplos e soltos.' },
    { nome: 'Agachamento lento', seg: 30, dica: 'Desça só até onde for confortável.' },
  ];
  const volta = exs.length * r.trabalho + (exs.length - 1) * r.descanso;
  const disponivel = Math.max(4, o.minutos) * 60 - 120 - 60; // tira aquecimento e alongamento final
  const voltas = Math.max(1, Math.min(6, Math.floor((disponivel + 60) / (volta + 60))));
  const blocos: Bloco[] = [...aquec];
  for (let v = 0; v < voltas; v++) {
    exs.forEach((e, i) => {
      blocos.push({ nome: e.nome, seg: r.trabalho, dica: e.dica });
      if (i < exs.length - 1) blocos.push({ nome: 'Descanso', seg: r.descanso, descanso: true });
    });
    if (v < voltas - 1) blocos.push({ nome: `Descanso · volta ${v + 2} de ${voltas} a seguir`, seg: 60, descanso: true });
  }
  blocos.push({ nome: 'Alongamento de pernas e costas', seg: 60, dica: 'Respire fundo e solte o corpo.' });
  const equipNome = { nada: 'sem equipamento', elastico: 'com elástico', halteres: 'com halteres', academia: 'na academia do hotel' }[o.equipamento];
  return {
    id: `viagem-${o.foco}-${o.equipamento}-${o.minutos}`,
    nome: `Treino de viagem ${o.minutos} min`,
    categoria: 'Em casa',
    nivel: o.nivel,
    met: o.silencioso ? 5.5 : 7,
    desc: `${voltas} ${voltas === 1 ? 'volta' : 'voltas'} de ${exs.length} exercícios ${equipNome}${o.silencioso ? ', sem saltos' : ''}.`,
    blocos,
  };
}

export const DICAS_VIAGEM = [
  'Leve um elástico de treino na mala: pesa menos de 100 g e substitui vários aparelhos.',
  'No avião, levante e caminhe a cada 1 a 2 horas e beba água; ajuda a circulação e o inchaço.',
  'Fuso horário: pegue sol de manhã no destino e treine leve no primeiro dia para ajustar o relógio do corpo.',
  'No buffet do hotel: comece por proteína (ovos, iogurte, frios magros) e frutas antes dos pães.',
  'Restaurante: peça grelhado com salada e troque a fritura por legumes; molho à parte.',
  'Sem tempo? 10 minutos de treino mantêm o hábito vivo. O importante é não zerar a sequência.',
  'Caminhar para conhecer a cidade conta! 8 a 10 mil passos já são um ótimo dia de viagem.',
  'Leve whey ou castanhas em porções: salvam o lanche no aeroporto sem gastar muito.',
];
