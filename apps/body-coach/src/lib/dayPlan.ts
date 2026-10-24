// Treino do dia personalizado: junta o que o aluno respondeu no cadastro (nível, lesões, objetivo),
// a divisão e a ênfase que ele escolheu e como ele está HOJE (sono, comida, dor, tempo, equipamento).
import type { Exercise, Session } from '@/mocks/workout';
import { EXERCICIOS, POR_ID, lesoesDoTexto, permitido, demoDoExercicio, type Equip, type Exercicio, type Grupo, type Lesao } from './exerciseDb';

export type Divisao = 'abc' | 'abcd' | 'ppl' | 'upper_lower' | 'fullbody' | 'fullbody_ab' | 'inferior_enfase' | 'abcd_gluteo';
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
  // Iniciante, 60+ ou foco em saúde: cada músculo 2 a 3 vezes por semana, sessões simples (A e B se alternam).
  fullbody_ab: { nome: 'Corpo inteiro A/B', dias: [
    { titulo: 'A · Corpo inteiro (pernas e empurrar)', grupos: ['quadriceps', 'peito', 'costas', 'ombros', 'abdomen'] },
    { titulo: 'B · Corpo inteiro (glúteos e puxar)', grupos: ['gluteos', 'posterior', 'costas', 'peito', 'biceps', 'triceps'] },
  ] },
  // Foco em pernas e glúteos (padrão para mulheres, ou quem marcar esse foco), 3 dias.
  inferior_enfase: { nome: 'ABC foco pernas e glúteos', dias: [
    { titulo: 'A · Pernas e glúteos', grupos: ['quadriceps', 'gluteos', 'posterior', 'panturrilha'] },
    { titulo: 'B · Superior completo', grupos: ['costas', 'peito', 'ombros', 'biceps', 'triceps'] },
    { titulo: 'C · Glúteos, posterior e abdômen', grupos: ['gluteos', 'posterior', 'abdomen'] },
  ] },
  // Foco em glúteos com 4 dias ou mais: dois dias de inferior por semana.
  abcd_gluteo: { nome: 'ABCD foco glúteos', dias: [
    { titulo: 'A · Pernas (quadríceps e glúteos)', grupos: ['quadriceps', 'gluteos', 'panturrilha'] },
    { titulo: 'B · Costas, bíceps e abdômen', grupos: ['costas', 'biceps', 'abdomen'] },
    { titulo: 'C · Glúteos e posterior', grupos: ['gluteos', 'posterior', 'abdomen'] },
    { titulo: 'D · Peito, ombros e tríceps', grupos: ['peito', 'ombros', 'triceps'] },
  ] },
};

// ===== Personalização pela anamnese =====
// Cada resposta do cadastro muda o treino: sexo, objetivo(s), nível, idade, onde treina, foco, rotina e dias.
// Pessoas diferentes recebem exercícios diferentes (escolha estável por pessoa, renovada a cada 4 semanas).
export type Sexo = 'F' | 'M' | null;
type R = Record<string, unknown> | null | undefined;

export function sexoDe(r: R): Sexo {
  const v = String(r?.sex ?? r?.sexo ?? r?.gender ?? '').trim().toLowerCase();
  if (/^(f|mulher)/.test(v)) return 'F';
  if (/^(m|homem)/.test(v)) return 'M';
  return null;
}

// Objetivos marcados (pode ser mais de um). Perfis antigos só têm "goal".
export function objetivosDe(r: R): string[] {
  const lista = Array.isArray(r?.goals) ? (r!.goals as unknown[]) : [];
  // Com a lista marcada, "goal" é só o resumo dela (ex.: Recomposição) e não entra de novo.
  const todos = (lista.length ? lista : r?.goal ? [r.goal] : []).map((x) => String(x ?? '').trim()).filter(Boolean);
  return [...new Set(todos)];
}

// Objetivo principal (calorias e textos): emagrecer + ganhar músculo vira Recomposição.
export function objetivoPrincipal(objetivos: string[]): string {
  const perder = objetivos.includes('Perda de gordura');
  const ganhar = objetivos.includes('Hipertrofia') || objetivos.includes('Estética');
  if (perder && ganhar) return 'Recomposição';
  return objetivos[0] ?? '';
}

export const LOCAIS_TREINO: Record<string, Equip[]> = {
  'Academia completa': ['barra', 'halter', 'maquina', 'cabo', 'corpo', 'smith'],
  'Academia pequena': ['barra', 'halter', 'maquina', 'cabo', 'corpo'],
  'Em casa com halteres': ['halter', 'corpo'],
  'Em casa sem equipamento': ['corpo'],
};

export const FOCOS: Record<string, Grupo[]> = {
  'Glúteos': ['gluteos'], 'Pernas': ['quadriceps', 'posterior'], 'Abdômen': ['abdomen'], 'Braços': ['biceps', 'triceps'],
  'Peito': ['peito'], 'Costas': ['costas'], 'Ombros': ['ombros'],
};

export const ROTINAS = ['Fico sentado quase o dia todo', 'Ando e fico em pé boa parte do dia', 'Trabalho pesado ou muito ativo'];

export function focoDe(r: R): Grupo[] {
  const marcados = Array.isArray(r?.focus) ? (r!.focus as string[]) : [];
  const grupos = [...new Set(marcados.flatMap((f) => FOCOS[f] ?? []))];
  if (grupos.length) return grupos;
  return sexoDe(r) === 'F' ? ['gluteos'] : [];
}

function idadeDe(r: R): number {
  const n = Number(r?.age);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Número estável a partir de um texto (mesma pessoa = mesma escolha; pessoas diferentes = escolhas diferentes).
function hash(t: string): number {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Ciclo menstrual (opcional, desligado por padrão: a aluna liga no Perfil).
// A ciência mostra efeito pequeno e diferente de mulher para mulher (McNulty 2020; Colenso-Semple 2023):
// o app só sugere, nunca corta o treino. Dias 1 a 3 com um pouco mais de reserva; avisos curtos por fase.
export type FaseCiclo = 'menstrual' | 'folicular' | 'ovulacao' | 'lutea' | 'pre';
export interface Ciclo { ligado?: boolean; inicio?: string; duracao?: number }

export function faseDoCiclo(c: Ciclo | null | undefined, agora = new Date()): { fase: FaseCiclo; dia: number } | null {
  if (!c?.ligado || !c.inicio) return null;
  const ini = new Date(`${c.inicio}T12:00:00`);
  if (Number.isNaN(ini.getTime())) return null;
  const dur = Math.min(45, Math.max(21, Number(c.duracao) || 28));
  const passados = Math.floor((new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 12).getTime() - ini.getTime()) / 86_400_000);
  if (passados < 0) return null;
  const dia = (passados % dur) + 1;
  const ovul = dur - 14;
  const fase: FaseCiclo = dia <= 5 ? 'menstrual' : dia < ovul - 1 ? 'folicular' : dia <= ovul + 1 ? 'ovulacao' : dia > dur - 5 ? 'pre' : 'lutea';
  return { fase, dia };
}

const AVISO_CICLO: Record<FaseCiclo, string> = {
  menstrual: 'Fase menstrual: se tiver cólica ou cansaço, pegue mais leve (deixei mais reserva nos primeiros dias). Treinar costuma até aliviar.',
  folicular: 'Fase folicular: muitas mulheres se sentem mais fortes agora. Boa hora para tentar subir a carga.',
  ovulacao: 'Perto da ovulação: aqueça bem as articulações antes de pegar pesado.',
  lutea: 'Fase lútea: o corpo esquenta mais. Beba mais água e mantenha as cargas se sentir mais cansaço.',
  pre: 'Pré-menstrual: inchaço e cansaço são normais. Foque na técnica; carga se ajusta pelo que você sentir.',
};

// Bloco de 4 semanas (mesociclo): os exercícios acessórios mudam a cada bloco para o corpo não se acostumar.
export function blocoAtual(agora = Date.now()): number {
  return Math.floor(agora / (28 * 86_400_000));
}

// Sugestão inicial pelos dias por semana e pelo resto da anamnese (nível, idade, sexo, foco, objetivo).
export function divisaoSugerida(diasPorSemana: number, r?: R): Divisao {
  if (diasPorSemana <= 2) return 'fullbody';
  if (r) {
    const objs = objetivosDe(r);
    const iniciante = /^inic/i.test(String(r.level ?? ''));
    const saude = objs.length > 0 && objs.every((o) => o === 'Saúde' || o === 'Condicionamento');
    if (idadeDe(r) >= 60 || saude || (iniciante && diasPorSemana === 3)) return 'fullbody_ab';
    if (iniciante) return 'upper_lower';
    const inferior = focoDe(r).some((g) => g === 'gluteos' || g === 'quadriceps' || g === 'posterior');
    if (inferior) return diasPorSemana === 3 ? 'inferior_enfase' : 'abcd_gluteo';
    if (diasPorSemana >= 5 && /^avan/i.test(String(r.level ?? ''))) return 'ppl';
  }
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

// Dose (séries, repetições, reserva e descanso) pelo nível, pelos objetivos (pode ser mais de um), sexo e idade.
// Base: posicionamentos do ACSM (2009/2026) e Schoenfeld (hipertrofia 6–30 reps perto da falha; força 1–6).
function dose(nivel: unknown, objetivos: string[], sexo: Sexo = null, idade = 0) {
  let d = { series: 3, reps: '8–12', rir: 2, descanso: 120, isoReps: '12–15', isoDescanso: 75, finalizar: false };
  if (nivel === 'Iniciante') d = { ...d, series: 3, reps: '10–12', rir: 3, descanso: 90 };
  else if (nivel === 'Avançado' || nivel === 'Alto desempenho') d = { ...d, series: 4, reps: '6–10', rir: 1, descanso: 150 };
  const tem = (...o: string[]) => o.some((x) => objetivos.includes(x));
  const forca = tem('Força', 'Performance', 'Competição');
  const massa = tem('Hipertrofia', 'Estética', 'Recomposição');
  const queimar = tem('Perda de gordura', 'Condicionamento');
  if (forca && massa) d = { ...d, reps: '5–8', rir: Math.max(d.rir, 2), descanso: 150 };
  else if (forca) d = { ...d, reps: '4–6', rir: Math.max(d.rir, 2), descanso: 180 };
  else if (massa && queimar) d = { ...d, reps: '8–12', descanso: 75, isoDescanso: 45, finalizar: true };
  else if (queimar) d = { ...d, reps: '12–15', descanso: 60, isoDescanso: 45, finalizar: true };
  else if (tem('Saúde', 'Recuperação')) d = { ...d, reps: '10–15', rir: Math.max(d.rir, 3), descanso: 90 };
  // Mulheres se recuperam mais rápido entre séries (Hunter 2014): descanso um pouco menor e mais repetições nos isolados.
  if (sexo === 'F') d = { ...d, descanso: Math.max(45, d.descanso - 15), isoReps: '12–20', isoDescanso: Math.max(40, d.isoDescanso - 10) };
  if (idade >= 50) d = { ...d, rir: Math.max(d.rir, 2), descanso: d.descanso + 15 };
  return d;
}

// Preferência de equipamento pelo nível e pela idade: iniciante e 50+ começam pelas máquinas (mais seguras para aprender).
// Peso do corpo, mas precisa de barra ou banco: fora de "em casa sem equipamento".
const PRECISA_APARELHO = new Set(['barra-fixa', 'mergulho-no-banco']);
// Barra fixa quase ninguém tem em casa, nem quem tem halteres: em casa ela sai sempre (a remada com halter entra no lugar).
// Versões de casa (supino no chão, rosca com elástico...): na academia, só se não houver outra opção.
const DE_CASA = new Set(['supino-no-chao-com-halteres', 'flexao-inclinada-maos-no-sofa-ou-banco', 'remada-invertida-na-mesa', 'superman', 'flexao-pike',
  'rosca-com-elastico', 'flexao-diamante', 'agachamento-livre-sem-peso', 'ponte-de-posterior-no-solo', 'elevacao-pelvica-unilateral',
  'abducao-de-quadril-deitada', 'coice-em-quatro-apoios', 'panturrilha-em-pe-no-degrau', 'abdominal-curto-no-solo', 'elevacao-pelvica-com-halter']);
function pontos(x: Exercicio, nivel: unknown, idade: number, semente: number, naAcademia: boolean): number {
  const ini = nivel === 'Iniciante' || idade >= 50;
  const avan = nivel === 'Avançado' || nivel === 'Alto desempenho';
  const tabela: Record<Equip, number> = ini
    ? { maquina: 3, cabo: 2, halter: 2, smith: 2, corpo: 1, barra: 0 }
    : avan ? { barra: 3, halter: 2, cabo: 1.5, maquina: 1, smith: 1, corpo: 0.5 }
      : { barra: 2, halter: 2, maquina: 2, cabo: 2, smith: 1, corpo: 1 };
  return tabela[x.equip] + (hash(`${semente}|${x.id}`) % 1000) / 500 // até +2: varia de pessoa para pessoa
    - (naAcademia && DE_CASA.has(x.id) ? 4 : 0);
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

const NOME_GRUPO_CURTO: Record<Grupo, string> = { peito: 'peito', costas: 'costas', ombros: 'ombros', biceps: 'bíceps', triceps: 'tríceps', quadriceps: 'quadríceps', posterior: 'posterior', gluteos: 'glúteos', panturrilha: 'panturrilha', abdomen: 'abdômen' };

const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function montarTreinoDoDia(e: EntradaDoDia): TreinoDoDia {
  const dias = DIVISOES[e.divisao].dias;
  const dia = dias[((e.diaDaDivisao % dias.length) + dias.length) % dias.length];
  const lesoes = lesoesDoTexto(e.respostas.injuries, e.respostas.symptoms, e.respostas.history, e.estado.dores);
  const objetivos = objetivosDe(e.respostas);
  const sexo = sexoDe(e.respostas);
  const idade = idadeDe(e.respostas);
  const base = dose(e.respostas.level, objetivos, sexo, idade);
  const local = String(e.respostas.place ?? '');
  const equipOk = LOCAIS_TREINO[local] ?? null;
  const foco = focoDe(e.respostas);
  const rotina = String(e.respostas.lifestyle ?? '');
  const semente = hash(`${String(e.respostas.name ?? '')}|${sexo}|${objetivos.join(',')}|${local}|${blocoAtual()}`) + e.variacao;
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
  const ciclo = sexo === 'F' ? faseDoCiclo(e.respostas.ciclo as Ciclo | undefined) : null;
  if (ciclo) {
    if (ciclo.fase === 'menstrual' && ciclo.dia <= 3) rir += 1;
    avisos.push(`Dia ${ciclo.dia} do ciclo. ${AVISO_CICLO[ciclo.fase]}`);
  }
  if (rotina === ROTINAS[2]) { series = Math.max(2, series - 1); avisos.push('Seu dia já é pesado: deixei uma série a menos por exercício para você recuperar bem.'); }
  if (lesoes.size) avisos.push(`Evitei exercícios que sobrecarregam: ${[...lesoes].join(', ')}. Se doer durante o movimento, pare e avise o coach.`);

  // Quantos exercícios cabem no tempo (cerca de 9 minutos cada, com descanso).
  const maxExercicios = Math.max(3, Math.floor(e.estado.tempoMin / 9) - corte);

  // Escolha por grupo: compostos primeiro, ênfase ganha um exercício a mais.
  const escolhidos: Exercicio[] = [];
  const sobras: Exercicio[][] = [];
  const posNoGrupo = new Map<string, number>(); // 0 = o principal do grupo; o tempo corta primeiro os de número maior
  let grupos = dia.grupos;
  let tituloDia = dia.titulo;
  if (cadeirante) {
    grupos = grupos.filter((g) => GRUPOS_SUPERIORES.includes(g));
    if (!grupos.length) { grupos = ['costas', 'ombros', 'abdomen']; avisos.push('Dia de pernas trocado por costas, ombros e core sentado.'); tituloDia = 'Costas, ombros e core (sentado)'; }
  }
  if (gestante) grupos = grupos.filter((g) => g !== 'abdomen');
  for (const g of grupos) {
    const seguros = EXERCICIOS.filter((x) => x.grupo === g && permitido(x, lesoes, e.estado.indisponiveis) && !(cadeirante && (NAO_SENTADO.test(x.nome) || x.equip === 'smith')) && !(gestante && /levantamento terra|stiff/i.test(x.nome)));
    // Onde a pessoa treina: só o que ela tem. Se não sobrar nada, vale o peso do corpo.
    let opcoes = equipOk ? seguros.filter((x) => equipOk.includes(x.equip) && !(local === 'Em casa sem equipamento' && PRECISA_APARELHO.has(x.id)) && !(local.startsWith('Em casa') && x.id === 'barra-fixa')) : seguros;
    if (!opcoes.length && equipOk) opcoes = seguros.filter((x) => x.equip === 'corpo' || x.equip === 'halter');
    if (!opcoes.length) { avisos.push(`Sem opção segura para ${g} hoje com suas limitações; pulei esse grupo.`); continue; }
    const naAcademia = !equipOk || equipOk.includes('maquina');
    const porPontos = (a: Exercicio, b: Exercicio) => pontos(b, e.respostas.level, idade, semente, naAcademia) - pontos(a, e.respostas.level, idade, semente, naAcademia) || a.id.localeCompare(b.id);
    const compostos = opcoes.filter((x) => x.composto).sort(porPontos);
    const isolados = opcoes.filter((x) => !x.composto).sort(porPontos);
    const pequeno = g === 'panturrilha' || g === 'abdomen' || g === 'biceps' || g === 'triceps';
    const quantos = e.enfase.includes(g) ? 3 : (pequeno ? 1 : 2) + (foco.includes(g) ? 1 : 0);
    // Músculo grande: dois compostos de equipamentos diferentes (ex.: supino com barra + com halteres).
    // Os outros e o foco da pessoa: um composto e um isolado (ex.: glúteo: elevação pélvica + abdução).
    const grande = (g === 'peito' || g === 'costas' || g === 'quadriceps') && !foco.includes(g);
    const segundo = grande ? compostos.slice(1).find((x) => x.equip !== compostos[0].equip) ?? compostos[1] : isolados[0];
    const primeiros = [compostos[0] ?? isolados[0], segundo].filter((x, i, l): x is Exercicio => !!x && l.indexOf(x) === i);
    const ordem = [...primeiros, ...compostos.filter((x) => !primeiros.includes(x)), ...isolados.filter((x) => !primeiros.includes(x))];
    ordem.forEach((x, i) => posNoGrupo.set(x.id, i - (foco.includes(g) || e.enfase.includes(g) ? 1 : 0)));
    escolhidos.push(...ordem.slice(0, quantos));
    sobras.push(ordem.slice(quantos));
  }
  // Sobrou tempo: completa com mais exercícios dos mesmos grupos, um grupo por vez (até 8 no total).
  const alvo = Math.min(maxExercicios, 8);
  for (let rodada = 0; escolhidos.length < alvo && sobras.some((l) => l.length > rodada); rodada++) {
    for (const l of sobras) if (escolhidos.length < alvo && l[rodada]) escolhidos.push(l[rodada]);
  }
  if (e.enfase.length) avisos.push(`Dei prioridade a: ${e.enfase.join(', ')}.`);

  // Compostos antes dos isolados; corta o excesso pelo tempo (o foco e a ênfase são os últimos a sair).
  // Pouco tempo: sai primeiro o 2º exercício de cada grupo, depois o 3º... (todo grupo do dia fica com o principal).
  const ficam = new Set([...escolhidos].map((x, i) => ({ x, i })).sort((a, b) => (posNoGrupo.get(a.x.id) ?? 9) - (posNoGrupo.get(b.x.id) ?? 9) || a.i - b.i)
    .slice(0, maxExercicios).map((p) => p.x));
  escolhidos.sort((a, b) => Number(b.composto) - Number(a.composto));
  const lista = escolhidos.filter((x) => ficam.has(x));
  const tempoDoCadastro = Number(e.respostas.minutes) || 60;
  if (lista.length < escolhidos.length && e.estado.tempoMin < tempoDoCadastro) avisos.push(`Com ${e.estado.tempoMin} min, deixei ${lista.length} exercícios.`);

  const exercicios: Exercise[] = lista.map((x) => ({
    id: x.id,
    name: x.nome,
    muscleGroup: x.grupo,
    targetReps: x.composto ? base.reps : base.isoReps,
    targetSets: x.composto ? series : Math.max(2, series),
    restSec: (x.composto ? base.descanso : base.isoDescanso) + (idoso || mobReduzida ? 30 : 0),
    note: `Alvo RIR ${rir}.`,
    videoUrl: demoDoExercicio(x.id)?.[0] ?? '',
    minWeight: 0,
    maxWeight: 300,
    weightUnit: 'kg',
    prevSession: { date: 'Sem registro anterior', sets: [] },
    sets: [],
  }));

  if (base.finalizar && !cadeirante && !gestante && !cansado) {
    avisos.push(equipOk && !equipOk.includes('maquina')
      ? 'Para fechar: 8 min de polichinelo e agachamento em intervalos (30 s forte, 30 s leve). Ajuda a queimar gordura sem perder músculo.'
      : 'Para fechar: 10 min de cardio intervalado (30 s forte, 60 s leve) na bike ou esteira. Ajuda a queimar gordura sem perder músculo.');
  }
  const paraVoce = [
    sexo === 'F' ? 'mulher' : sexo === 'M' ? 'homem' : '',
    objetivos.length ? objetivos.join(' + ').toLowerCase() : '',
    String(e.respostas.level ?? '').toLowerCase(),
    local ? local.toLowerCase() : '',
    foco.length ? `foco em ${foco.map((g) => NOME_GRUPO_CURTO[g]).join(', ')}` : '',
  ].filter(Boolean);
  if (paraVoce.length >= 2) avisos.unshift(`Feito para você: ${paraVoce.join(' · ')}.`);

  const aquecimento = [
    { name: cadeirante ? 'Aquecimento de ombros, punhos e braços (rotações e elásticos)' : equipOk && !equipOk.includes('maquina') ? 'Aquecimento leve (marcha no lugar e polichinelo)' : 'Aquecimento leve (bike ou esteira)', durationSec: 300 },
    { name: 'Mobilidade articular', durationSec: 180 },
    ...(rotina === ROTINAS[0] ? [{ name: 'Mobilidade de quadril e coluna (para quem fica muito sentado)', durationSec: 120 }] : []),
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
