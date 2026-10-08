// Ficha de treino do aluno (periodização): qual divisão ele segue e qual é o próximo dia do ciclo.
// Fica no perfil (bodycoach_users/{uid}/profile/main, campo "ficha") e avança sozinha a cada treino feito.
import { DIVISOES, divisaoSugerida, type Divisao } from './dayPlan';

export interface Ficha { divisao: Divisao; proximoDia: number }

export function fichaDoPerfil(perfil: { ficha?: Partial<Ficha>; onboarding?: Record<string, unknown> } | null | undefined): Ficha {
  const padrao = divisaoSugerida(Number(perfil?.onboarding?.daysPerWeek ?? 4));
  const divisao = perfil?.ficha?.divisao && perfil.ficha.divisao in DIVISOES ? perfil.ficha.divisao : padrao;
  const n = DIVISOES[divisao].dias.length;
  const dia = Number(perfil?.ficha?.proximoDia ?? 0);
  return { divisao, proximoDia: Number.isInteger(dia) && dia >= 0 && dia < n ? dia : 0 };
}

// Depois de um treino da ficha, o próximo dia do ciclo é o seguinte (volta ao A depois do último).
export function avancarFicha(f: Ficha): Ficha {
  return { divisao: f.divisao, proximoDia: (f.proximoDia + 1) % DIVISOES[f.divisao].dias.length };
}
