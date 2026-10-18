// Cardio por foto do painel: a IA grátis lê a tela, o app valida os números e soma as calorias da semana.
export interface SessaoCardio { id: string; em: number; aparelho: string; tempoSeg: number; km: number; kcal: number; kmh: number; passos: number }

const num = (v: unknown, max: number): number => {
  const n = Number(typeof v === 'string' ? v.replace(',', '.') : v);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0;
};

// Pega o JSON da resposta da IA (mesmo se vier com texto em volta) e limita cada número a um valor possível.
export function lerPainel(texto: string): Omit<SessaoCardio, 'id' | 'em'> | null {
  const m = /\{[\s\S]*\}/.exec(texto || '');
  if (!m) return null;
  let j: Record<string, unknown>;
  try { j = JSON.parse(m[0]); } catch { return null; }
  const aparelhos = ['esteira', 'bike', 'escada', 'eliptico', 'outro'];
  const r = {
    aparelho: aparelhos.includes(String(j.aparelho)) ? String(j.aparelho) : 'outro',
    tempoSeg: Math.round(num(j.tempo_seg, 6 * 3600)),
    km: Math.round(num(j.distancia_km, 200) * 100) / 100,
    kcal: Math.round(num(j.kcal, 3000) * 10) / 10,
    kmh: Math.round(num(j.velocidade_kmh, 40) * 10) / 10,
    passos: Math.round(num(j.passos, 60000)),
  };
  return r.tempoSeg || r.km || r.kcal ? r : null;
}

// Segunda-feira 00:00 da semana de `ref`.
export function inicioDaSemana(ref: number): number {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export function resumoSemana(lista: SessaoCardio[], ref = Date.now()) {
  const ini = inicioDaSemana(ref);
  const fim = ini + 7 * 86400000;
  const da = lista.filter((s) => s.em >= ini && s.em < fim);
  return {
    sessoes: da.length,
    kcal: Math.round(da.reduce((a, s) => a + s.kcal, 0)),
    km: Math.round(da.reduce((a, s) => a + s.km, 0) * 10) / 10,
    minutos: Math.round(da.reduce((a, s) => a + s.tempoSeg, 0) / 60),
  };
}

// Avaliação curta pelo objetivo (sem prometer resultado). 7700 kcal ≈ 1 kg de gordura.
export function avaliarSemana(kcal: number, objetivo: string): string {
  const o = (objetivo || '').toLowerCase();
  if (kcal <= 0) return 'Ainda sem cardio nesta semana. Mande a foto do painel depois de cada sessão.';
  const kg = (kcal / 7700).toFixed(2).replace('.', ',');
  if (/emagre|defini|perder|gordura/.test(o)) {
    if (kcal < 1000) return `Você gastou ${kcal} kcal no cardio (≈ ${kg} kg de gordura se a dieta estiver em déficit). Para emagrecer, o ideal é chegar perto de 1.500 a 2.500 kcal por semana.`;
    return `Boa: ${kcal} kcal no cardio (≈ ${kg} kg de gordura se a dieta estiver em déficit). Está na faixa boa para emagrecer. Mantenha a proteína alta para não perder músculo.`;
  }
  if (/hipert|massa|ganhar|musc/.test(o)) {
    if (kcal > 2500) return `${kcal} kcal de cardio na semana é bastante para quem quer ganhar massa. Se o peso não estiver subindo, reduza o cardio ou coma mais.`;
    return `${kcal} kcal de cardio na semana é um bom equilíbrio para ganhar massa: ajuda o coração sem atrapalhar a recuperação.`;
  }
  return `${kcal} kcal de cardio nesta semana (≈ ${kg} kg de gordura). Com 150 minutos de cardio por semana você já cuida bem do coração.`;
}
