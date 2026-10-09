// Ficha de treino do aluno (periodização): qual divisão ele segue e qual é o próximo dia do ciclo.
// Fica no perfil (bodycoach_users/{uid}/profile/main, campo "ficha") e avança sozinha a cada treino feito.
// A tela inicial, a ficha e o treino iniciado usam TODOS esta mesma fonte, para nunca mostrarem treinos diferentes.
import { DIVISOES, divisaoSugerida, montarTreinoDoDia, type Divisao, type EstadoDoDia, type TreinoDoDia } from './dayPlan';
import type { Grupo } from './exerciseDb';

export interface Ficha { divisao: Divisao; proximoDia: number }

// O questionário grava "days"; perfis antigos podem ter "daysPerWeek".
export function diasPorSemana(respostas: Record<string, unknown> | null | undefined): number {
  const n = Number(respostas?.days ?? respostas?.daysPerWeek);
  return Number.isFinite(n) && n > 0 ? n : 4;
}

// Minutos por treino que o aluno informou no questionário (20 a 120, padrão 60).
export function tempoDoPerfil(respostas: Record<string, unknown> | null | undefined): number {
  const n = Number(respostas?.minutes);
  if (!Number.isFinite(n) || n <= 0) return 60;
  return Math.min(120, Math.max(20, Math.round(n / 5) * 5));
}

export function fichaDoPerfil(perfil: { ficha?: Partial<Ficha>; onboarding?: Record<string, unknown> } | null | undefined): Ficha {
  const padrao = divisaoSugerida(diasPorSemana(perfil?.onboarding));
  const divisao = perfil?.ficha?.divisao && perfil.ficha.divisao in DIVISOES ? perfil.ficha.divisao : padrao;
  const n = DIVISOES[divisao].dias.length;
  const dia = Number(perfil?.ficha?.proximoDia ?? 0);
  return { divisao, proximoDia: Number.isInteger(dia) && dia >= 0 && dia < n ? dia : 0 };
}

// Estado "normal" do dia: é o que a ficha e a tela inicial mostram antes do aluno contar como está.
export function estadoPadrao(respostas: Record<string, unknown> | null | undefined): EstadoDoDia {
  return { sono: 'bom', alimentacao: 'comi_bem', energia: 4, tempoMin: tempoDoPerfil(respostas), dores: '', indisponiveis: [] };
}

// Treino de um dia da ficha. Sempre a mesma escolha de exercícios (variacao 0), para a ficha,
// a tela inicial e o treino iniciado baterem.
export function treinoDaFicha(respostas: Record<string, unknown>, divisao: Divisao, dia: number, estado?: EstadoDoDia, enfase: Grupo[] = []): TreinoDoDia {
  return montarTreinoDoDia({ respostas, divisao, diaDaDivisao: dia, enfase, estado: estado ?? estadoPadrao(respostas), variacao: 0 });
}

// Depois de um treino da ficha, o próximo dia do ciclo é o seguinte (volta ao A depois do último).
export function avancarFicha(f: Ficha): Ficha {
  return { divisao: f.divisao, proximoDia: (f.proximoDia + 1) % DIVISOES[f.divisao].dias.length };
}
