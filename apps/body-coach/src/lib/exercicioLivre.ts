// Exercício que não está na lista: o aluno escreve o nome (ex.: "Tríceps coice" porque a corda estava ocupada)
// e ele entra no treino como qualquer outro. E o que foi feito "no intervalo" (ex.: abdominal no descanso)
// fica anotado sem virar exercício da ficha.
import type { Exercise, Session } from '@/mocks/workout';
import { EXERCICIOS, POR_ID, demoDoExercicio } from './exerciseDb';
import { idDoNome } from './coach/fichaCoach';

// Nomes comuns de academia que não estão no banco do app (só para sugerir enquanto digita).
export const NOMES_COMUNS = [
  'Tríceps coice com halter', 'Tríceps testa', 'Tríceps banco', 'Tríceps unilateral na polia',
  'Rosca Scott', 'Rosca concentrada', 'Rosca 21', 'Rosca inversa',
  'Supino declinado', 'Peck deck', 'Crucifixo com halteres', 'Pullover',
  'Remada cavalinho', 'Puxada triângulo', 'Puxada supinada', 'Remada alta',
  'Elevação frontal', 'Desenvolvimento militar', 'Arnold press',
  'Agachamento búlgaro', 'Passada', 'Cadeira adutora', 'Cadeira abdutora', 'Glúteo na polia', 'Glúteo 4 apoios', 'Sumô na polia',
  'Abdominal supra', 'Abdominal infra', 'Abdominal oblíquo', 'Abdominal remador', 'Prancha lateral', 'Abdominal bicicleta',
  'Panturrilha em pé livre', 'Burpee', 'Polichinelo', 'Corda (pular)', 'Escalador',
];

// Coisas rápidas que se faz no descanso entre séries.
export const NO_INTERVALO = ['Abdominal', 'Prancha', 'Panturrilha', 'Alongamento', 'Polichinelo', 'Corda'];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// Sugestões enquanto digita: primeiro o banco do app (tem demonstração), depois os nomes comuns.
export function sugerirNomes(texto: string, max = 6): string[] {
  const q = norm(texto);
  if (q.length < 2) return [];
  const todos = [...EXERCICIOS.map((e) => e.nome), ...NOMES_COMUNS];
  const comeca = todos.filter((n) => norm(n).startsWith(q));
  const contem = todos.filter((n) => !norm(n).startsWith(q) && norm(n).includes(q));
  return [...new Set([...comeca, ...contem])].slice(0, max);
}

// Exercício do banco com esse nome exato (ignora acento e maiúscula), se houver.
export const doBanco = (nome: string) => EXERCICIOS.find((e) => norm(e.nome) === norm(nome));

// Monta o exercício escrito pelo aluno no formato do treino. Herda séries/reps/descanso de `base` (o que estava no lugar).
export function exercicioLivre(nome: string, base?: Exercise, idsNoTreino: string[] = []): Exercise {
  const limpo = nome.trim().replace(/\s+/g, ' ').slice(0, 60);
  const banco = doBanco(limpo);
  let id = banco ? banco.id : idDoNome(limpo);
  // O mesmo exercício duas vezes no treino: as séries ficam separadas.
  for (let n = 2; idsNoTreino.includes(id); n++) id = `${banco ? banco.id : idDoNome(limpo)}-${n}`;
  return {
    id,
    name: banco ? banco.nome : limpo,
    muscleGroup: banco?.grupo ?? base?.muscleGroup ?? '',
    targetReps: base?.targetReps || '8-12',
    targetSets: base?.targetSets || 3,
    restSec: base?.restSec || 60,
    note: banco ? 'Exercício trocado por você hoje.' : 'Exercício escrito por você. Anote as séries normalmente.',
    videoUrl: banco ? demoDoExercicio(banco.id)?.[0] ?? '' : '',
    minWeight: 0,
    maxWeight: 300,
    weightUnit: base?.weightUnit === 'kg/lado' ? 'kg' : base?.weightUnit || 'kg',
    prevSession: { date: 'Sem registro anterior', sets: [] },
    sets: [],
  };
}

// Troca o exercício da posição `i` pelo que o aluno escreveu (as séries feitas nele recomeçam).
export function trocarPorLivre(s: Session, i: number, nome: string): Session {
  const atual = s.exercises[i];
  if (!atual || !nome.trim()) return s;
  const novo = exercicioLivre(nome, atual, s.exercises.filter((_, k) => k !== i).map((e) => e.id));
  return { ...s, exercises: s.exercises.map((e, k) => (k === i ? novo : e)) };
}

// Coloca um exercício a mais logo depois da posição `i`.
export function adicionarDepois(s: Session, i: number, nome: string): Session {
  if (!nome.trim()) return s;
  const novo = exercicioLivre(nome, s.exercises[i], s.exercises.map((e) => e.id));
  const ex = [...s.exercises];
  ex.splice(Math.min(ex.length, i + 1), 0, novo);
  return { ...s, exercises: ex };
}

// Algo feito no descanso (não vira exercício da ficha): "Abdominal · 3x20 · no intervalo do Supino".
export interface Extra { id: string; nome: string; quanto: string; depoisDe: string }

export function novoExtra(nome: string, quanto: string, depoisDe: string): Extra | null {
  const n = nome.trim().replace(/\s+/g, ' ').slice(0, 60);
  if (!n) return null;
  return { id: `x-${Date.now().toString(36)}`, nome: n, quanto: quanto.trim().slice(0, 40), depoisDe: depoisDe.slice(0, 60) };
}

export const textoExtra = (x: Extra) => `${x.nome}${x.quanto ? ` · ${x.quanto}` : ''}`;

// Vai na conversa com o coach junto com as notas das séries.
export const notaDoExtra = (x: Extra) => ({ ex: x.nome, serie: 1, falha: false, nota: `no intervalo de ${x.depoisDe}${x.quanto ? `: ${x.quanto}` : ''}`, carga: 0, reps: 0, extra: true });

export const ehLivre = (id: string) => !POR_ID[id.replace(/-\d+$/, '')] && !POR_ID[id];
