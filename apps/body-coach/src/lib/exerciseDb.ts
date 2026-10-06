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

// Opções para trocar um exercício: mesmo grupo, respeitando lesões, sem repetir os que já estão no treino.
export function alternativas(id: string, lesoes: Set<Lesao>, indisponiveis: string[], jaNoTreino: string[]): Exercicio[] {
  const base = POR_ID[id];
  if (!base) return [];
  return EXERCICIOS.filter((e) => e.grupo === base.grupo && e.id !== id && !jaNoTreino.includes(e.id) && permitido(e, lesoes, indisponiveis))
    .sort((a, b) => Number(b.composto === base.composto) - Number(a.composto === base.composto));
}

// Vídeo de execução: busca pronta no YouTube (grátis, sem chave).
export const videoDeExecucao = (nome: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`como fazer ${nome} execução correta`)}`;
