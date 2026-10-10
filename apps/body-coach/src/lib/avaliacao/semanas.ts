// Treino, dieta e corpo semana a semana: quantos treinos, quanta proteína por dia (média dos dias com
// refeição lançada) e o peso/gordura da avaliação daquela semana. Puro, para testar.
export interface Semana { inicio: string; rotulo: string; treinos: number; proteina: number | null; diasDieta: number; peso: number | null; gordura: number | null }

const DIA = 86400000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

function segundaDe(t: number): number {
  const d = new Date(t);
  const dia = (d.getUTCDay() + 6) % 7; // segunda = 0
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - dia * DIA;
}

export function semanasTreinoDieta(
  treinos: { done_at?: string }[],
  refeicoes: { created_at?: string; protein?: number }[],
  pontos: { data: string; m: Record<string, number> }[],
  quantas = 12,
  agora = Date.now(),
): Semana[] {
  const ultima = segundaDe(agora);
  const out: Semana[] = [];
  for (let i = quantas - 1; i >= 0; i--) {
    const ini = ultima - i * 7 * DIA;
    const fim = ini + 7 * DIA;
    const dentro = (s?: string) => { const t = s ? Date.parse(s.length === 10 ? `${s}T12:00:00Z` : s) : NaN; return t >= ini && t < fim; };
    const porDia = new Map<string, number>();
    for (const r of refeicoes) if (dentro(r.created_at)) porDia.set(r.created_at!.slice(0, 10), (porDia.get(r.created_at!.slice(0, 10)) ?? 0) + (Number(r.protein) || 0));
    const doCorpo = pontos.filter((p) => dentro(p.data));
    const ult = doCorpo[doCorpo.length - 1];
    const d = iso(ini);
    out.push({
      inicio: d,
      rotulo: `${d.slice(8, 10)}/${d.slice(5, 7)}`,
      treinos: treinos.filter((w) => dentro(w.done_at)).length,
      proteina: porDia.size ? Math.round([...porDia.values()].reduce((a, b) => a + b, 0) / porDia.size) : null,
      diasDieta: porDia.size,
      peso: ult?.m.peso ?? null,
      gordura: ult?.m.gordura ?? null,
    });
  }
  return out;
}

// Frase curta que liga os três: ritmo das últimas 4 semanas e o que aconteceu com o corpo.
export function leituraSemanas(semanas: Semana[], pesoKg: number | null): string | null {
  const ult4 = semanas.slice(-4);
  const treinos = ult4.reduce((a, s) => a + s.treinos, 0) / ult4.length;
  const prots = ult4.map((s) => s.proteina).filter((p): p is number => p != null);
  const prot = prots.length ? Math.round(prots.reduce((a, b) => a + b, 0) / prots.length) : null;
  const gord = semanas.filter((s) => s.gordura != null);
  const delta = gord.length > 1 ? Math.round((gord[gord.length - 1].gordura! - gord[0].gordura!) * 10) / 10 : null;
  if (!treinos && prot == null) return null;
  const metaProt = pesoKg ? Math.round(pesoKg * 1.6) : null;
  const partes = [`Nas últimas 4 semanas: ${treinos.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} treino(s) por semana`];
  if (prot != null) partes.push(`${prot} g de proteína por dia${metaProt ? ` (mínimo sugerido: ${metaProt} g)` : ''}`);
  let fim = '';
  if (delta != null) fim = delta < 0 ? ` No período, a gordura caiu ${Math.abs(delta).toLocaleString('pt-BR')} ponto(s). Continue assim!` : delta > 0 ? ` No período, a gordura subiu ${delta.toLocaleString('pt-BR')} ponto(s).${treinos < 3 ? ' Treinar 3 ou mais vezes por semana ajuda.' : ''}${prot != null && metaProt && prot < metaProt ? ' A proteína está abaixo do sugerido.' : ''}` : ' No período, a gordura ficou igual.';
  return `${partes.join(' e ')}.${fim}`;
}
