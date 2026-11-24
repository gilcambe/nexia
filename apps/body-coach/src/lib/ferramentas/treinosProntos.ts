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

// Tiros em aparelho (esteira, bike, escada, elíptico, remo): aquece, N tiros forte/leve, desaquece.
function tiros(aquec: [number, string], n: number, forte: [number, string], leve: [number, string], desaq: [number, string]): Bloco[] {
  return [
    { nome: 'Aquecer', seg: aquec[0], dica: aquec[1] },
    ...Array.from({ length: n }, (_, i) => [
      { nome: `TIRO ${i + 1} de ${n}: acelere`, seg: forte[0], dica: forte[1] },
      { nome: 'Recupere: ritmo leve', seg: leve[0], dica: leve[1], descanso: true },
    ]).flat(),
    { nome: 'Desaquecer', seg: desaq[0], dica: desaq[1] },
  ];
}

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
  // ── Mais abdômen / core ──
  {
    id: 'core-iniciante', nome: 'Core iniciante 8 min', categoria: 'Abdômen', nivel: 'Iniciante', met: 3.5,
    desc: 'Para quem está começando: protege a lombar e firma a barriga.',
    blocos: circuito([
      ['Dead bug', 'Lombar colada no chão, braço e perna opostos.'], ['Prancha nos joelhos', 'Barriga encolhida.'], ['Ponte de glúteo', 'Aperte o glúteo em cima.'],
      ['Bird dog (perdigueiro)', 'Braço e perna opostos, sem girar o quadril.'],
    ], 30, 20, 3, 30),
  },
  {
    id: 'core-lombar', nome: 'Core sem dor nas costas 10 min', categoria: 'Abdômen', nivel: 'Iniciante', met: 3.5,
    desc: 'Exercícios de estabilidade, bons para quem tem lombar sensível.',
    blocos: circuito([
      ['Prancha', 'Corpo reto do ombro ao pé.'], ['Dead bug', 'Devagar, solte o ar ao estender.'], ['Prancha lateral (direita)', 'Pode apoiar o joelho.'],
      ['Prancha lateral (esquerda)', 'Pode apoiar o joelho.'], ['Bird dog (perdigueiro)', 'Segure 2 s em cima.'], ['Superman', 'Olhar para o chão, sem forçar o pescoço.'],
    ], 35, 15, 2, 45),
  },
  {
    id: 'abs-obliquos', nome: 'Oblíquos e cintura 12 min', categoria: 'Abdômen', nivel: 'Intermediário', met: 4.5,
    desc: 'Foco nas laterais da barriga.',
    blocos: circuito([
      ['Russian twist', 'Gire o tronco, não só os braços.'], ['Prancha lateral com elevação de quadril (direita)', 'Sobe e desce devagar.'],
      ['Prancha lateral com elevação de quadril (esquerda)', 'Sobe e desce devagar.'], ['Bicicleta no ar', 'Cotovelo no joelho oposto.'],
      ['Abdominal oblíquo cruzado', 'Ombro em direção ao joelho oposto.'], ['Limpador de para-brisa', 'Pernas juntas de um lado ao outro, com controle.'],
    ], 40, 15, 2, 45),
  },
  {
    id: 'abs-5min', nome: 'Abdômen expresso 5 min', categoria: 'Abdômen', nivel: 'Intermediário', met: 4.5,
    desc: 'Para encaixar no fim do treino de musculação.',
    blocos: circuito([
      ['Abdominal crunch', 'Curto e controlado.'], ['Elevação de pernas', 'Lombar no chão.'], ['Prancha', 'Firme.'], ['Mountain climber', 'Rápido.'], ['Hollow hold', 'Segure.'],
    ], 45, 15, 1),
  },
  {
    id: 'core-academia', nome: 'Core na academia 15 min', categoria: 'Abdômen', nivel: 'Avançado', met: 5,
    desc: 'Com aparelhos: roda, polia e barra fixa.',
    blocos: circuito([
      ['Rolinho / roda abdominal', 'Vá só até onde a lombar não arqueia.'], ['Abdominal na polia (ajoelhado)', 'Enrole a coluna, quadril parado.'],
      ['Elevação de pernas na barra fixa', 'Sem balançar.'], ['Pallof press na polia (direita)', 'Não deixe o tronco girar.'], ['Pallof press na polia (esquerda)', 'Não deixe o tronco girar.'],
      ['Prancha com peso nas costas', 'Peso leve, corpo reto.'],
    ], 40, 20, 3, 60),
  },
  // ── Mais HIIT ──
  {
    id: 'hiit-sem-impacto', nome: 'HIIT sem impacto 15 min', categoria: 'HIIT', nivel: 'Iniciante', met: 6,
    desc: 'Sem pulos: bom para joelho, apartamento e iniciante.',
    blocos: [...AQUEC, ...circuito([
      ['Agachamento rápido', 'Sem pular.'], ['Soco no ar alternado', 'Abdômen firme.'], ['Escalador lento', 'Um pé de cada vez.'], ['Afundo para trás alternado', 'Tronco reto.'],
      ['Polichinelo sem salto', 'Braços acima da cabeça.'],
    ], 40, 20, 3, 60)],
  },
  {
    id: 'hiit-emom', nome: 'EMOM 16 min', categoria: 'HIIT', nivel: 'Avançado', met: 9,
    desc: 'A cada minuto: faça as repetições e descanse o que sobrar.',
    blocos: [...AQUEC, ...Array.from({ length: 4 }, () => seq([
      ['10 burpees e descanse o resto do minuto', 60], ['15 agachamentos com salto e descanse', 60], ['20 mountain climbers por perna e descanse', 60], ['12 flexões e descanse', 60],
    ])).flat()],
  },
  {
    id: 'hiit-corda', nome: 'Corda de pular HIIT 12 min', categoria: 'HIIT', nivel: 'Intermediário', met: 10,
    desc: 'Pule 40 s e descanse 20 s. Sem corda, imite o movimento.',
    blocos: [...AQUEC, ...circuito([['Corda: pulo normal', 'Saltos baixos, na ponta dos pés.'], ['Corda: alternando os pés', 'Como uma corrida no lugar.'], ['Corda: o mais rápido que der', 'Tudo!']], 40, 20, 3, 60)],
  },
  // ── HIIT em aparelhos de cardio ──
  {
    id: 'esteira-30-30', nome: 'Esteira HIIT 30/30 · 18 min', categoria: 'Cardio', nivel: 'Intermediário', met: 9,
    desc: '12 tiros de 30 s forte com 30 s leve. Muito gasto em pouco tempo.',
    blocos: tiros([240, 'Caminhe a 5-6 km/h e depois trote.'], 12, [30, 'Corra forte: 11 a 15 km/h.'], [30, 'Caminhe a 5-6 km/h (ou fique nas laterais da esteira).'], [180, 'Caminhada leve.']),
  },
  {
    id: 'esteira-inclinada', nome: 'Esteira inclinada (caminhando) 25 min', categoria: 'Cardio', nivel: 'Iniciante', met: 6,
    desc: 'Sem correr: a inclinação sobe e desce. Queima bem sem impacto.',
    blocos: seq([
      ['Aquecer: plano, 5 km/h', 180], ['Inclinação 4%', 180], ['Inclinação 8%', 180], ['Inclinação 12%', 180, 'Não segure no apoio.'], ['Inclinação 15%', 120, 'Passos curtos.'],
      ['Inclinação 10%', 180], ['Inclinação 12%', 180], ['Inclinação 6%', 120], ['Desaquecer: plano, 4 km/h', 180],
    ]),
  },
  {
    id: 'bike-hiit', nome: 'Bike HIIT 20/40 · 15 min', categoria: 'Cardio', nivel: 'Intermediário', met: 8.5,
    desc: '10 sprints de 20 s com carga alta e 40 s soltando as pernas.',
    blocos: tiros([240, 'Carga leve, 80-90 rpm.'], 10, [20, 'Carga alta, pedale o máximo que der.'], [40, 'Carga mínima, giro solto.'], [120, 'Carga leve.']),
  },
  {
    id: 'bike-iniciante', nome: 'Bike intervalada iniciante 20 min', categoria: 'Cardio', nivel: 'Iniciante', met: 6,
    desc: '1 min mais forte e 2 min leve. Para começar sem sofrer.',
    blocos: tiros([180, 'Carga leve.'], 5, [60, 'Suba 2 a 3 níveis de carga.'], [120, 'Volte para carga leve.'], [120, 'Carga mínima.']),
  },
  {
    id: 'escada-hiit', nome: 'Escada (simulador) intervalada 20 min', categoria: 'Cardio', nivel: 'Intermediário', met: 9,
    desc: 'Na escada da academia: 1 min rápido e 1 min devagar. Glúteo e perna trabalham muito.',
    blocos: tiros([180, 'Nível baixo, mãos leves no apoio.'], 8, [60, 'Suba o nível: degraus rápidos, sem se apoiar.'], [60, 'Nível baixo.'], [180, 'Nível mínimo.']),
  },
  {
    id: 'escada-predio', nome: 'Escada de prédio 15 min', categoria: 'Cardio', nivel: 'Intermediário', met: 8,
    desc: 'Suba rápido e desça andando. Segure no corrimão ao descer.',
    blocos: tiros([120, 'Suba devagar 2 andares.'], 6, [60, 'Suba rápido, de degrau em degrau.'], [60, 'Desça andando com calma.'], [120, 'Caminhe no plano.']),
  },
  {
    id: 'eliptico-hiit', nome: 'Elíptico HIIT 20 min', categoria: 'Cardio', nivel: 'Iniciante', met: 7,
    desc: 'Sem impacto nos joelhos. 40 s forte e 80 s leve.',
    blocos: tiros([180, 'Resistência leve.'], 8, [40, 'Resistência alta e passada rápida.'], [80, 'Resistência leve.'], [120, 'Bem leve.']),
  },
  {
    id: 'remo-hiit', nome: 'Remo HIIT 15 min', categoria: 'Cardio', nivel: 'Intermediário', met: 8.5,
    desc: 'Remada: pernas empurram primeiro, depois puxe com os braços.',
    blocos: tiros([180, 'Ritmo leve, 20 remadas por minuto.'], 8, [30, 'Forte: 28-32 remadas por minuto.'], [60, 'Leve.'], [120, 'Leve.']),
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
