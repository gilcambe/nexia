// Treinos prontos guiados (HIIT, abdômen, alongamento, yoga, mobilidade, casa, cardio) e planos de corrida.
// Cada treino é uma lista de blocos com tempo; o player conta o tempo, fala e apita. Tudo no aparelho.

export interface Bloco { nome: string; seg: number; dica?: string; descanso?: boolean }
export interface TreinoPronto {
  id: string;
  nome: string;
  categoria: 'HIIT' | 'Abdômen' | 'Alongamento' | 'Yoga' | 'Mobilidade' | 'Em casa' | 'Cardio';
  nivel: 'Iniciante' | 'Intermediário' | 'Avançado';
  met: number; // gasto: MET × peso × horas
  desc: string;
  blocos: Bloco[];
}

const D = (seg: number, nome = 'Descanso'): Bloco => ({ nome, seg, descanso: true });

function circuito(exs: [string, string][], trabalho: number, descanso: number, voltas: number, entreVoltas = 0): Bloco[] {
  const out: Bloco[] = [];
  for (let v = 0; v < voltas; v++) {
    exs.forEach(([nome, dica], i) => {
      out.push({ nome, seg: trabalho, dica });
      const ultimo = i === exs.length - 1;
      if (!ultimo && descanso) out.push(D(descanso));
      if (ultimo && v < voltas - 1) out.push(D(entreVoltas || descanso, `Descanso · volta ${v + 2} de ${voltas} a seguir`));
    });
  }
  return out;
}
const seq = (exs: [string, number, string?][]): Bloco[] => exs.map(([nome, seg, dica]) => ({ nome, seg, dica }));

const AQUEC: Bloco[] = seq([
  ['Marcha no lugar', 40, 'Braços acompanhando, respiração solta.'],
  ['Rotação de ombros', 30, 'Para frente e para trás.'],
  ['Agachamento livre lento', 40, 'Desça até onde for confortável.'],
  ['Polichinelo leve', 40, 'Pode fazer sem salto.'],
]);

export const TREINOS_PRONTOS: TreinoPronto[] = [
  {
    id: 'tabata', nome: 'Tabata 4 minutos', categoria: 'HIIT', nivel: 'Intermediário', met: 9,
    desc: '8 rodadas de 20 s no máximo e 10 s de pausa. Curto e muito intenso.',
    blocos: [...AQUEC, ...circuito([['Burpee', 'Peito no chão e salto no final.'], ['Agachamento com salto', 'Aterrisse macio, joelhos para fora.']], 20, 10, 4, 10)],
  },
  {
    id: 'hiit20', nome: 'HIIT queima 20 min', categoria: 'HIIT', nivel: 'Intermediário', met: 8,
    desc: 'Circuito 40/20 de corpo inteiro para gastar muita caloria.',
    blocos: [...AQUEC, ...circuito([
      ['Polichinelo', 'Ritmo forte.'], ['Mountain climber', 'Quadril baixo, joelho no peito.'], ['Agachamento com salto', 'Explosão para cima.'],
      ['Flexão de braço', 'Pode apoiar os joelhos.'], ['Skipping alto', 'Joelhos na altura do quadril.'], ['Afundo alternado', 'Joelho de trás quase no chão.'],
    ], 40, 20, 3, 60)],
  },
  {
    id: 'hiit-iniciante', nome: 'HIIT iniciante 12 min', categoria: 'HIIT', nivel: 'Iniciante', met: 6,
    desc: '30 s de esforço e 30 s de pausa, sem saltos.',
    blocos: [...AQUEC, ...circuito([
      ['Agachamento', 'Peso nos calcanhares.'], ['Polichinelo sem salto', 'Um pé de cada vez.'], ['Flexão na parede', 'Corpo reto.'], ['Marcha rápida', 'Joelhos altos.'],
    ], 30, 30, 2, 60)],
  },
  {
    id: 'abs10', nome: 'Abdômen 10 min', categoria: 'Abdômen', nivel: 'Iniciante', met: 4,
    desc: 'Core forte e cintura firme, sem equipamento.',
    blocos: circuito([
      ['Abdominal crunch', 'Solte o ar subindo, queixo longe do peito.'], ['Prancha', 'Glúteo contraído, quadril alinhado.'], ['Bicicleta no ar', 'Cotovelo no joelho oposto, devagar.'],
      ['Elevação de pernas', 'Lombar colada no chão.'], ['Prancha lateral (direita)', 'Quadril alto.'], ['Prancha lateral (esquerda)', 'Quadril alto.'],
    ], 40, 15, 2, 30),
  },
  {
    id: 'abs-avancado', nome: 'Abdômen trincado 15 min', categoria: 'Abdômen', nivel: 'Avançado', met: 5,
    desc: 'Mais tempo sob tensão e exercícios difíceis.',
    blocos: circuito([
      ['V-up', 'Mãos tocam os pés.'], ['Prancha com toque no ombro', 'Sem balançar o quadril.'], ['Russian twist', 'Pés fora do chão.'],
      ['Hollow hold', 'Lombar no chão, corpo em "banana".'], ['Mountain climber cruzado', 'Joelho no cotovelo oposto.'], ['Abdominal canivete', 'Controle na descida.'],
    ], 45, 15, 3, 45),
  },
  {
    id: 'along-pos', nome: 'Alongamento pós-treino', categoria: 'Alongamento', nivel: 'Iniciante', met: 2.3,
    desc: '8 minutos para soltar o corpo e acelerar a recuperação.',
    blocos: seq([
      ['Posterior de coxa (direita)', 30, 'Perna esticada, incline o tronco sem forçar.'], ['Posterior de coxa (esquerda)', 30],
      ['Quadríceps em pé (direita)', 30, 'Calcanhar no glúteo, joelhos juntos.'], ['Quadríceps em pé (esquerda)', 30],
      ['Glúteo cruzado deitado (direita)', 30], ['Glúteo cruzado deitado (esquerda)', 30],
      ['Peitoral na parede (direita)', 30], ['Peitoral na parede (esquerda)', 30],
      ['Ombro cruzado (direita)', 25], ['Ombro cruzado (esquerda)', 25],
      ['Tríceps atrás da cabeça (direita)', 25], ['Tríceps atrás da cabeça (esquerda)', 25],
      ['Panturrilha na parede', 40, 'Calcanhar no chão.'], ['Postura da criança', 60, 'Respire fundo e solte as costas.'],
    ]),
  },
  {
    id: 'along-manha', nome: 'Acordar o corpo 6 min', categoria: 'Alongamento', nivel: 'Iniciante', met: 2.3,
    desc: 'Rotina matinal para tirar a rigidez e ganhar disposição.',
    blocos: seq([
      ['Espreguiçar em pé', 30, 'Braços para cima, cresça.'], ['Inclinação lateral', 40, 'Alterne os lados.'], ['Rotação de pescoço', 30, 'Devagar.'],
      ['Gato e vaca', 60, 'Quatro apoios: arredonde e arqueie a coluna.'], ['Afundo com rotação', 60, 'Alterne as pernas.'], ['Rolamento da coluna em pé', 40, 'Desça vértebra por vértebra.'],
      ['Respiração profunda', 60, '4 s entra, 6 s sai.'],
    ]),
  },
  {
    id: 'yoga-sol', nome: 'Yoga: saudação ao sol 15 min', categoria: 'Yoga', nivel: 'Iniciante', met: 3,
    desc: 'Sequência clássica para força, flexibilidade e foco.',
    blocos: [
      ...seq([['Postura da montanha', 45, 'Pés firmes, respiração pelo nariz.']]),
      ...Array.from({ length: 4 }, () => seq([
        ['Braços para o alto', 15], ['Flexão para frente', 20, 'Joelhos podem dobrar.'], ['Afundo (perna direita atrás)', 25],
        ['Prancha', 20], ['Cobra', 20, 'Ombros longe das orelhas.'], ['Cachorro olhando para baixo', 30, 'Calcanhares em direção ao chão.'],
        ['Afundo (perna esquerda atrás)', 25], ['Flexão para frente', 20], ['Volta à montanha', 15],
      ])).flat(),
      ...seq([['Guerreiro II (direita)', 40], ['Guerreiro II (esquerda)', 40], ['Árvore (direita)', 30, 'Olhar fixo num ponto.'], ['Árvore (esquerda)', 30], ['Relaxamento final', 90, 'Deitado, corpo solto.']]),
    ],
  },
  {
    id: 'yoga-sono', nome: 'Yoga para dormir 10 min', categoria: 'Yoga', nivel: 'Iniciante', met: 2,
    desc: 'Posturas suaves para desacelerar antes de deitar.',
    blocos: seq([
      ['Respiração 4-7-8', 60, '4 s entra, 7 s segura, 8 s sai.'], ['Postura da criança', 60], ['Torção deitada (direita)', 45], ['Torção deitada (esquerda)', 45],
      ['Borboleta deitada', 60, 'Solas dos pés juntas.'], ['Pernas na parede', 120, 'Melhora a circulação.'], ['Joelhos no peito', 45], ['Relaxamento total', 120, 'Solte cada parte do corpo.'],
    ]),
  },
  {
    id: 'mob-quadril', nome: 'Mobilidade de quadril e coluna 8 min', categoria: 'Mobilidade', nivel: 'Iniciante', met: 2.5,
    desc: 'Para quem fica muito sentado e para agachar melhor.',
    blocos: seq([
      ['Gato e vaca', 45], ['Rotação torácica (direita)', 40, 'Quatro apoios, mão na nuca.'], ['Rotação torácica (esquerda)', 40],
      ['90/90 de quadril', 60, 'Troque de lado devagar.'], ['Afundo profundo (direita)', 45], ['Afundo profundo (esquerda)', 45],
      ['Agachamento sustentado', 60, 'Cotovelos empurram os joelhos.'], ['Ponte de glúteo', 45], ['Abertura de quadril em pé', 40],
    ]),
  },
  {
    id: 'mob-ombro', nome: 'Ombros sem dor 6 min', categoria: 'Mobilidade', nivel: 'Iniciante', met: 2.5,
    desc: 'Mobilidade e ativação para antes de treinar peito, costas e ombros.',
    blocos: seq([
      ['Círculos de braço', 40], ['Anjo na parede', 45, 'Costas e braços colados na parede.'], ['Rotação externa com elástico ou toalha', 45],
      ['Passagem com bastão ou toalha', 45, 'Braços esticados, vai e volta.'], ['Prancha escapular', 40, 'Só as escápulas se movem.'], ['Y-T-W deitado', 60],
    ]),
  },
  {
    id: 'casa20', nome: 'Corpo todo em casa 20 min', categoria: 'Em casa', nivel: 'Intermediário', met: 6,
    desc: 'Força sem equipamento: usa só o peso do corpo e uma cadeira.',
    blocos: [...AQUEC, ...circuito([
      ['Agachamento', 'Desça com controle.'], ['Flexão de braço', 'Peito perto do chão.'], ['Afundo búlgaro na cadeira (direita)', 'Pé de trás na cadeira.'],
      ['Afundo búlgaro na cadeira (esquerda)', ''], ['Tríceps no banco/cadeira', 'Cotovelos para trás.'], ['Ponte de glúteo unilateral', 'Alterne a cada volta.'], ['Prancha', 'Firme.'],
    ], 45, 15, 3, 60)],
  },
  {
    id: 'esteira', nome: 'Esteira intervalada 20 min', categoria: 'Cardio', nivel: 'Intermediário', met: 8,
    desc: 'Tiros de 1 min forte e 2 min leve. Ajuste a velocidade quando o app falar.',
    blocos: [
      { nome: 'Caminhada para aquecer', seg: 180, dica: 'Velocidade 5 a 6 km/h.' },
      ...Array.from({ length: 5 }, () => [
        { nome: 'TIRO: acelere', seg: 60, dica: 'Ritmo forte, 10 a 14 km/h ou inclinação 8%.' },
        { nome: 'Recupere: ritmo leve', seg: 120, dica: 'Volte para 6 a 7 km/h.', descanso: true },
      ]).flat(),
      { nome: 'Desaquecer caminhando', seg: 120 },
    ],
  },
  {
    id: 'bike', nome: 'Bike pirâmide 25 min', categoria: 'Cardio', nivel: 'Intermediário', met: 7,
    desc: 'Carga sobe e desce: ótimo para assistir algo enquanto pedala.',
    blocos: seq([
      ['Aquecer leve', 240, 'Carga leve, giro solto.'], ['Carga média', 180], ['Carga forte', 120], ['Carga muito forte', 60, 'Quase no limite.'],
      ['Carga forte', 120], ['Carga média', 180], ['Sprint final', 60, 'Tudo o que tiver!'], ['Soltar as pernas', 240, 'Carga mínima.'], ['Alongar em cima da bike', 60],
    ]),
  },
];

export const CATEGORIAS_PRONTOS = ['HIIT', 'Abdômen', 'Alongamento', 'Yoga', 'Mobilidade', 'Em casa', 'Cardio'] as const;

export function duracaoMin(t: TreinoPronto): number {
  return Math.round(t.blocos.reduce((s, b) => s + b.seg, 0) / 60);
}
export function kcalTreinoPronto(t: TreinoPronto, pesoKg: number, segFeitos?: number): number {
  const seg = segFeitos ?? t.blocos.reduce((s, b) => s + b.seg, 0);
  return Math.round(t.met * (pesoKg || 70) * (seg / 3600));
}

// Planos de corrida: semanas com 3 corridas (rodagem, tiros, longão).
export interface PlanoCorrida { id: string; nome: string; semanas: { semana: number; treinos: string[] }[] }
function planoCorrida(id: string, nome: string, longoBase: number, longoMax: number, n: number, tiros: string[]): PlanoCorrida {
  const semanas = Array.from({ length: n }, (_, i) => {
    const deload = (i + 1) % 4 === 0 && i < n - 1;
    const prova = i === n - 1;
    const longo = Math.round((longoBase + ((longoMax - longoBase) * i) / Math.max(1, n - 2)) * (deload ? 0.7 : 1) * 2) / 2;
    if (prova) return { semana: i + 1, treinos: ['Rodagem leve 20–30 min', 'Educativos + 4 acelerações de 100 m', `🏁 PROVA: ${nome.replace('Plano ', '')}`] };
    return {
      semana: i + 1,
      treinos: [
        `Rodagem leve ${Math.round(25 + i * 2)} min (zona 2)`,
        deload ? 'Descanso ativo: 30 min de caminhada ou bike' : tiros[i % tiros.length],
        `Longão ${Math.min(longo, longoMax)} km em ritmo confortável`,
      ],
    };
  });
  return { id, nome, semanas };
}
export const PLANOS_CORRIDA: PlanoCorrida[] = [
  planoCorrida('5k', 'Plano 5 km', 2, 5, 8, ['6× 1 min forte / 2 min trote', '5× 400 m forte / 200 m trote', '3× 5 min ritmo de prova', '8× 200 m rápido / 200 m trote']),
  planoCorrida('10k', 'Plano 10 km', 4, 10, 10, ['6× 800 m forte / 400 m trote', '3× 8 min ritmo de prova', '10× 400 m / 200 m trote', '20 min ritmo forte contínuo']),
  planoCorrida('21k', 'Plano meia maratona 21 km', 8, 19, 12, ['5× 1 km forte / 400 m trote', '2× 15 min ritmo de prova', '8× 600 m / 300 m trote', '40 min ritmo de prova']),
];
