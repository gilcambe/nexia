// Banco de exercícios do Body Coach: grupo muscular, equipamento e quais lesões o exercício agrava.
// Usado para montar o treino do dia respeitando lesões, dores e equipamento, e para trocar exercícios.
export type Grupo = 'peito' | 'costas' | 'ombros' | 'biceps' | 'triceps' | 'quadriceps' | 'posterior' | 'gluteos' | 'panturrilha' | 'abdomen';
export type Equip = 'barra' | 'halter' | 'maquina' | 'cabo' | 'corpo' | 'smith';
export type Lesao = 'ombro' | 'cotovelo' | 'punho' | 'lombar' | 'joelho' | 'quadril' | 'tornozelo' | 'pescoco';

export interface Exercicio {
  id: string;
  nome: string;
  grupo: Grupo;
  equip: Equip;
  evita: Lesao[];
  composto: boolean;
}

const ex = (nome: string, grupo: Grupo, equip: Equip, composto: boolean, evita: Lesao[] = []): Exercicio => ({
  id: nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  nome, grupo, equip, composto, evita,
});

export const EXERCICIOS: Exercicio[] = [
  ex('Supino reto com barra', 'peito', 'barra', true, ['ombro', 'punho']),
  ex('Supino reto com halteres', 'peito', 'halter', true, ['ombro']),
  ex('Supino inclinado com halteres', 'peito', 'halter', true, ['ombro']),
  ex('Supino na máquina', 'peito', 'maquina', true),
  ex('Flexão de braços', 'peito', 'corpo', true, ['ombro', 'punho']),
  ex('Crucifixo na máquina', 'peito', 'maquina', false),
  ex('Crossover na polia', 'peito', 'cabo', false),
  ex('Puxada frontal', 'costas', 'cabo', true, ['ombro']),
  ex('Remada baixa no cabo', 'costas', 'cabo', true),
  ex('Remada na máquina', 'costas', 'maquina', true),
  ex('Remada unilateral com halter', 'costas', 'halter', true),
  ex('Remada curvada com barra', 'costas', 'barra', true, ['lombar']),
  ex('Barra fixa', 'costas', 'corpo', true, ['ombro', 'cotovelo']),
  ex('Levantamento terra', 'costas', 'barra', true, ['lombar', 'joelho']),
  ex('Pulldown com braços estendidos', 'costas', 'cabo', false, ['ombro']),
  ex('Desenvolvimento com halteres', 'ombros', 'halter', true, ['ombro']),
  ex('Desenvolvimento na máquina', 'ombros', 'maquina', true, ['ombro']),
  ex('Elevação lateral', 'ombros', 'halter', false, ['ombro']),
  ex('Elevação lateral no cabo', 'ombros', 'cabo', false, ['ombro']),
  ex('Face pull', 'ombros', 'cabo', false),
  ex('Crucifixo inverso na máquina', 'ombros', 'maquina', false),
  ex('Encolhimento com halteres', 'ombros', 'halter', false, ['pescoco']),
  ex('Rosca direta com barra', 'biceps', 'barra', false, ['cotovelo', 'punho']),
  ex('Rosca alternada com halteres', 'biceps', 'halter', false, ['cotovelo']),
  ex('Rosca martelo', 'biceps', 'halter', false),
  ex('Rosca no cabo', 'biceps', 'cabo', false),
  ex('Tríceps corda na polia', 'triceps', 'cabo', false),
  ex('Tríceps na polia com barra', 'triceps', 'cabo', false, ['cotovelo']),
  ex('Tríceps francês com halter', 'triceps', 'halter', false, ['cotovelo', 'ombro']),
  ex('Mergulho no banco', 'triceps', 'corpo', true, ['ombro', 'punho', 'cotovelo']),
  ex('Agachamento livre', 'quadriceps', 'barra', true, ['joelho', 'lombar', 'quadril']),
  ex('Agachamento goblet', 'quadriceps', 'halter', true, ['joelho']),
  ex('Agachamento no Smith', 'quadriceps', 'smith', true, ['joelho', 'lombar']),
  ex('Leg Press 45', 'quadriceps', 'maquina', true, ['joelho']),
  ex('Hack machine', 'quadriceps', 'maquina', true, ['joelho']),
  ex('Afundo com halteres', 'quadriceps', 'halter', true, ['joelho', 'quadril']),
  ex('Cadeira extensora', 'quadriceps', 'maquina', false, ['joelho']),
  ex('Stiff com barra', 'posterior', 'barra', true, ['lombar']),
  ex('Stiff com halteres', 'posterior', 'halter', true, ['lombar']),
  ex('Mesa flexora', 'posterior', 'maquina', false, ['joelho']),
  ex('Cadeira flexora', 'posterior', 'maquina', false),
  ex('Flexora em pé', 'posterior', 'maquina', false),
  ex('Elevação pélvica com barra', 'gluteos', 'barra', true),
  ex('Elevação pélvica no solo', 'gluteos', 'corpo', false),
  ex('Abdução de quadril na máquina', 'gluteos', 'maquina', false, ['quadril']),
  ex('Coice na polia', 'gluteos', 'cabo', false),
  ex('Agachamento sumô com halter', 'gluteos', 'halter', true, ['joelho', 'quadril']),
  ex('Panturrilha em pé na máquina', 'panturrilha', 'maquina', false, ['tornozelo']),
  ex('Panturrilha sentado', 'panturrilha', 'maquina', false, ['tornozelo']),
  ex('Panturrilha no leg press', 'panturrilha', 'maquina', false, ['tornozelo']),
  ex('Prancha', 'abdomen', 'corpo', false, ['ombro', 'lombar']),
  ex('Abdominal na polia', 'abdomen', 'cabo', false),
  ex('Abdominal na máquina', 'abdomen', 'maquina', false, ['pescoco']),
  ex('Elevação de pernas', 'abdomen', 'corpo', false, ['lombar', 'quadril']),
  ex('Dead bug', 'abdomen', 'corpo', false),
  // Em casa (halteres, elástico ou só o corpo): o treino de quem não vai à academia também fica completo.
  ex('Supino no chão com halteres', 'peito', 'halter', true, ['ombro']),
  ex('Crucifixo com halteres', 'peito', 'halter', false, ['ombro']),
  ex('Flexão inclinada (mãos no sofá ou banco)', 'peito', 'corpo', true, ['punho']),
  ex('Remada curvada com halteres', 'costas', 'halter', true, ['lombar']),
  ex('Remada invertida na mesa', 'costas', 'corpo', true, ['ombro']),
  ex('Superman', 'costas', 'corpo', false, ['lombar']),
  ex('Flexão pike', 'ombros', 'corpo', true, ['ombro', 'punho']),
  ex('Elevação frontal com halter', 'ombros', 'halter', false, ['ombro']),
  ex('Crucifixo inverso com halteres', 'ombros', 'halter', false),
  ex('Rosca concentrada', 'biceps', 'halter', false, ['cotovelo']),
  ex('Rosca com elástico', 'biceps', 'corpo', false),
  ex('Tríceps coice com halter', 'triceps', 'halter', false, ['cotovelo']),
  ex('Flexão diamante', 'triceps', 'corpo', true, ['punho', 'ombro', 'cotovelo']),
  ex('Agachamento livre sem peso', 'quadriceps', 'corpo', true, ['joelho']),
  ex('Agachamento búlgaro', 'quadriceps', 'halter', true, ['joelho', 'quadril']),
  ex('Subida no banco com halteres', 'quadriceps', 'halter', true, ['joelho']),
  ex('Stiff unilateral com halter', 'posterior', 'halter', true, ['lombar']),
  ex('Ponte de posterior no solo', 'posterior', 'corpo', false),
  ex('Elevação pélvica com halter', 'gluteos', 'halter', true),
  ex('Elevação pélvica unilateral', 'gluteos', 'corpo', false),
  ex('Abdução de quadril deitada', 'gluteos', 'corpo', false, ['quadril']),
  ex('Coice em quatro apoios', 'gluteos', 'corpo', false, ['punho']),
  ex('Panturrilha em pé no degrau', 'panturrilha', 'corpo', false, ['tornozelo']),
  ex('Prancha lateral', 'abdomen', 'corpo', false, ['ombro']),
  ex('Abdominal curto no solo', 'abdomen', 'corpo', false, ['pescoco']),
];

export const POR_ID: Record<string, Exercicio> = Object.fromEntries(EXERCICIOS.map((e) => [e.id, e]));

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Lê o texto livre do aluno (lesões, sintomas, dores de hoje) e devolve as regiões a poupar.
export function lesoesDoTexto(...textos: unknown[]): Set<Lesao> {
  const t = semAcento(textos.map((x) => (Array.isArray(x) ? x.join(' ') : String(x ?? ''))).join(' '));
  const out = new Set<Lesao>();
  if (/ombro|manguito|bursite|escapula/.test(t)) out.add('ombro');
  if (/cotovelo|epicondil/.test(t)) out.add('cotovelo');
  if (/punho|mao |pulso|tunel do carpo/.test(t)) out.add('punho');
  if (/lombar|coluna|hernia|ciatic|lombalgia|costas baixa/.test(t)) out.add('lombar');
  if (/joelho|menisco|ligamento|patela|condromalacia/.test(t)) out.add('joelho');
  if (/quadril|virilha|pubalgia|trocanter/.test(t)) out.add('quadril');
  if (/tornozelo|calcanhar|aquiles|fascite/.test(t)) out.add('tornozelo');
  if (/pescoco|cervical/.test(t)) out.add('pescoco');
  return out;
}

export const permitido = (e: Exercicio, lesoes: Set<Lesao>, indisponiveis: string[] = []) =>
  !e.evita.some((l) => lesoes.has(l)) && !indisponiveis.includes(e.id);

// Grupos que treinam junto/substituem quando o grupo do exercício não tem mais opção.
const GRUPOS_VIZINHOS: Record<Grupo, Grupo[]> = {
  peito: ['triceps', 'ombros'], costas: ['biceps', 'ombros'], ombros: ['peito', 'costas'], biceps: ['costas'], triceps: ['peito'],
  quadriceps: ['gluteos', 'posterior'], posterior: ['gluteos', 'quadriceps'], gluteos: ['posterior', 'quadriceps'],
  panturrilha: ['quadriceps'], abdomen: ['gluteos'],
};

export interface Alternativa { ex: Exercicio; aviso?: string }

const NOME_GRUPO: Record<Grupo, string> = { peito: 'peito', costas: 'costas', ombros: 'ombros', biceps: 'bíceps', triceps: 'tríceps', quadriceps: 'quadríceps', posterior: 'posterior de coxa', gluteos: 'glúteos', panturrilha: 'panturrilha', abdomen: 'abdômen' };

const NOME_LESAO: Record<Lesao, string> = { ombro: 'ombro', cotovelo: 'cotovelo', punho: 'punho', lombar: 'lombar', joelho: 'joelho', quadril: 'quadril', tornozelo: 'tornozelo', pescoco: 'pescoço' };

// Opções para trocar um exercício. A lista nunca fica vazia:
// 1) mesmo grupo, sem agravar lesões e fora do treino; 2) mesmo grupo que pode incomodar uma lesão (com aviso);
// 3) grupos vizinhos (com aviso). Exercício fora do banco usa o grupo muscular informado.
export function alternativas(id: string, lesoes: Set<Lesao>, indisponiveis: string[], jaNoTreino: string[], grupoInformado?: string): Alternativa[] {
  const base = POR_ID[id];
  const grupo = (base?.grupo ?? grupoInformado) as Grupo | undefined;
  if (!grupo || !(grupo in GRUPOS_VIZINHOS)) return [];
  const livre = (e: Exercicio) => e.id !== id && !jaNoTreino.includes(e.id) && !indisponiveis.includes(e.id);
  const parecido = (a: Exercicio, b: Exercicio) =>
    Number(b.composto === base?.composto) - Number(a.composto === base?.composto) || Number(b.equip === base?.equip) - Number(a.equip === base?.equip);
  const doGrupo = EXERCICIOS.filter((e) => e.grupo === grupo && livre(e)).sort(parecido);
  const out: Alternativa[] = doGrupo.filter((e) => permitido(e, lesoes)).map((ex) => ({ ex }));
  if (out.length < 2) {
    for (const ex of doGrupo.filter((e) => !permitido(e, lesoes))) {
      out.push({ ex, aviso: `Cuidado: pode incomodar ${ex.evita.filter((l) => lesoes.has(l)).map((l) => NOME_LESAO[l]).join(' e ')}` });
    }
  }
  if (out.filter((a) => !a.aviso).length < 2) {
    for (const g of GRUPOS_VIZINHOS[grupo]) {
      for (const ex of EXERCICIOS.filter((e) => e.grupo === g && livre(e) && permitido(e, lesoes)).sort(parecido).slice(0, 3)) {
        out.push({ ex, aviso: `Outro músculo: ${NOME_GRUPO[g]}` });
      }
    }
  }
  return out;
}

// Demonstração própria (banco no repositório, em public/exercicios): dois quadros que alternam como um vídeo curto.
// Fotos do free-exercise-db (domínio público). Sem YouTube, sem gasto de internet com vídeo pesado.
export const IDS_COM_DEMO = new Set([
  'crucifixo-com-halteres',
  'remada-invertida-na-mesa',
  'superman',
  'flexao-pike',
  'elevacao-frontal-com-halter',
  'crucifixo-inverso-com-halteres',
  'triceps-coice-com-halter',
  'abducao-de-quadril-deitada',
  'coice-em-quatro-apoios',
  'prancha-lateral',
  'abdominal-curto-no-solo',
]);
// Exercícios de casa sem foto própria usam a foto do movimento mais parecido.
const DEMO_PARECIDA: Record<string, string> = {
  'supino-no-chao-com-halteres': 'supino-reto-com-halteres', 'flexao-inclinada-maos-no-sofa-ou-banco': 'flexao-de-bracos', 'flexao-diamante': 'flexao-de-bracos',
  'remada-curvada-com-halteres': 'remada-unilateral-com-halter', 'agachamento-livre-sem-peso': 'agachamento-goblet', 'agachamento-bulgaro': 'afundo-com-halteres',
  'subida-no-banco-com-halteres': 'afundo-com-halteres', 'stiff-unilateral-com-halter': 'stiff-com-halteres', 'elevacao-pelvica-com-halter': 'elevacao-pelvica-no-solo',
  'elevacao-pelvica-unilateral': 'elevacao-pelvica-no-solo', 'ponte-de-posterior-no-solo': 'elevacao-pelvica-no-solo', 'panturrilha-em-pe-no-degrau': 'panturrilha-em-pe-na-maquina',
  'rosca-concentrada': 'rosca-alternada-com-halteres', 'rosca-com-elastico': 'rosca-alternada-com-halteres',
};
export const demoDoExercicio = (idPedido: string): [string, string] | null => {
  const id = IDS_COM_DEMO.has(idPedido) ? idPedido : DEMO_PARECIDA[idPedido] ?? idPedido;
  if (!IDS_COM_DEMO.has(id)) return null;
  const b = `${import.meta.env.BASE_URL}exercicios/${id}`;
  return [`${b}-0.webp`, `${b}-1.webp`];
};
