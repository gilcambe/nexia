// Metas de calorias e macros pelo objetivo do aluno, com ajuste semanal pelo que a balança mostrou (dieta adaptativa).
export interface Metas { calories: number; protein: number; fat: number; carbs: number; fiber: number }

// Fator sobre a manutenção (~33 kcal/kg): cortar para perder gordura, sobrar para ganhar massa.
const FATOR: Record<string, number> = {
  'Perda de gordura': 0.8, 'Recomposição': 0.92, 'Estética': 0.95,
  'Hipertrofia': 1.1, 'Força': 1.05, 'Performance': 1.1, 'Competição': 1.05,
};
// Ritmo saudável de variação por semana, em % do peso (negativo = perder).
const RITMO_SEMANAL: Record<string, number> = {
  'Perda de gordura': -0.5, 'Recomposição': -0.2, 'Estética': -0.25,
  'Hipertrofia': 0.25, 'Força': 0.15, 'Performance': 0.15, 'Competição': 0,
};

// Dados da anamnese que deixam a conta pessoal (Mifflin-St Jeor × nível de atividade). Sem eles, usa ~33 kcal/kg.
export interface PerfilMetas { sexo?: 'F' | 'M' | null; idade?: number; alturaCm?: number; rotina?: string; diasTreino?: number }

const ATIVIDADE: Record<string, number> = {
  'Fico sentado quase o dia todo': 1.3, 'Ando e fico em pé boa parte do dia': 1.45, 'Trabalho pesado ou muito ativo': 1.65,
};

// Lê o perfil salvo (profile/main) e devolve o que a conta pessoal precisa.
export function perfilMetasDe(perfil: { onboarding?: Record<string, unknown> | null; height_cm?: number | null; gender?: string | null } | null | undefined): PerfilMetas {
  const ob = perfil?.onboarding ?? {};
  const sx = String(ob.sex ?? perfil?.gender ?? '').toLowerCase();
  return {
    sexo: /^(f|mulher)/.test(sx) ? 'F' : /^(m|homem)/.test(sx) ? 'M' : null,
    idade: Number(ob.age) || undefined,
    alturaCm: Number(ob.height) || Number(perfil?.height_cm) || undefined,
    rotina: typeof ob.lifestyle === 'string' ? ob.lifestyle : undefined,
    diasTreino: Number(ob.days) || undefined,
  };
}

export function manutencao(peso: number, p?: PerfilMetas): number {
  if (!p?.sexo || !p.idade || !p.alturaCm || p.alturaCm < 120) return peso * 33;
  const tmb = 10 * peso + 6.25 * p.alturaCm - 5 * p.idade + (p.sexo === 'M' ? 5 : -161);
  const fator = (ATIVIDADE[p.rotina ?? ''] ?? 1.4) + Math.min(6, Math.max(0, p.diasTreino ?? 3)) * 0.035;
  return tmb * fator;
}

export function calcularMetas(peso: number, objetivo?: string | null, ajusteKcal = 0, perfil?: PerfilMetas): Metas {
  const cortando = objetivo === 'Perda de gordura' || objetivo === 'Recomposição' || objetivo === 'Estética';
  const base = Math.round(manutencao(peso, perfil) * (FATOR[objetivo ?? ''] ?? 1));
  const calories = Math.max(1200, base + Math.max(-500, Math.min(500, ajusteKcal)));
  const protein = Math.round(peso * (cortando ? 2.2 : 2));
  const fat = Math.round(peso * (cortando ? 0.8 : 0.9));
  const carbs = Math.max(50, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein, fat, carbs, fiber: 30 };
}

export interface PontoPeso { data: string; kg: number }
export interface AjusteSugerido { deltaKcal: number; variacaoKg: number; alvoKg: number; texto: string }

const media = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

// Compara a média dos últimos 7 dias com a dos 7 dias anteriores e diz quanto mexer nas calorias.
export function sugerirAjuste(pontos: PontoPeso[], objetivo?: string | null, agora = Date.now()): AjusteSugerido | null {
  const dia = 86_400_000;
  const vale = pontos.filter((p) => p.kg > 0 && Number.isFinite(new Date(p.data).getTime()));
  const recentes = vale.filter((p) => agora - new Date(p.data).getTime() <= 7 * dia).map((p) => p.kg);
  const anteriores = vale.filter((p) => { const d = agora - new Date(p.data).getTime(); return d > 7 * dia && d <= 14 * dia; }).map((p) => p.kg);
  if (!recentes.length || !anteriores.length) return null;
  const atual = media(recentes);
  const variacaoKg = Math.round((atual - media(anteriores)) * 100) / 100;
  const alvoKg = Math.round(atual * ((RITMO_SEMANAL[objetivo ?? ''] ?? 0) / 100) * 100) / 100;
  // 1 kg ≈ 7700 kcal; a diferença semanal vira ajuste diário, limitado a ±250 por semana (mudança gradual).
  const bruto = ((alvoKg - variacaoKg) * 7700) / 7;
  const deltaKcal = Math.max(-250, Math.min(250, Math.round(bruto / 50) * 50));
  if (Math.abs(deltaKcal) < 50) return { deltaKcal: 0, variacaoKg, alvoKg, texto: `Seu peso variou ${variacaoKg.toFixed(1).replace('.', ',')} kg na semana, dentro do ritmo esperado. Mantenha a dieta.` };
  const verbo = deltaKcal > 0 ? 'aumentar' : 'reduzir';
  return { deltaKcal, variacaoKg, alvoKg, texto: `Seu peso variou ${variacaoKg.toFixed(1).replace('.', ',')} kg na semana e o ritmo ideal para o seu objetivo é ${alvoKg.toFixed(1).replace('.', ',')} kg. Sugiro ${verbo} ${Math.abs(deltaKcal)} kcal por dia.` };
}
