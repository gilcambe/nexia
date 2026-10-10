// Troca de alimento por um equivalente do mesmo grupo (proteína por proteína, carbo por carbo...).
// A porção nova é calculada para dar o mesmo nutriente principal e calorias parecidas. Puro, sem tela.
import { BASE, POR_ID, porcaoDe, semAcento, type Alimento, type Base, type Grupo } from './dietPlan';

// Nutriente que manda na troca de cada grupo.
const CHAVE: Record<Grupo, 'p' | 'c' | 'g' | 'kcal'> = {
  prot: 'p', prot_leve: 'p', leguminosa: 'c', carbo: 'c', carbo_cafe: 'c', fruta: 'c', gord: 'g', leg: 'kcal',
};

// Porção "de verdade": unidades inteiras; gramas e ml de 5 em 5.
export function arredonda(a: Base, qtd: number): number {
  if (a.un === 'un') return Math.max(1, Math.round(qtd));
  return Math.max(5, Math.round(qtd / 5) * 5);
}

export function equivalentes(
  id: string,
  qtd: number,
  opts: { proibidas?: Set<string>; evitar?: string[]; limite?: number } = {},
): Alimento[] {
  const orig = POR_ID[id];
  if (!orig || !(qtd > 0)) return [];
  const m0 = qtd / orig.qtd;
  const chave = CHAVE[orig.grupos[0]];
  const kcal0 = orig.kcal * m0;
  const alvo0 = chave === 'kcal' ? kcal0 : orig[chave] * m0;
  const out: { a: Alimento; nota: number }[] = [];
  for (const cand of BASE) {
    if (cand.id === id || !cand.grupos.some((g) => orig.grupos.includes(g))) continue;
    if (opts.evitar?.includes(cand.id) || cand.evita.some((t) => opts.proibidas?.has(t))) continue;
    const valor = chave === 'kcal' ? cand.kcal : cand[chave];
    if (!(valor > 0) || !(cand.kcal > 0)) continue;
    const mChave = alvo0 / valor;
    const mKcal = kcal0 / cand.kcal;
    const m = chave === 'kcal' ? mKcal : Math.sqrt(mChave * mKcal);
    const q = arredonda(cand, cand.qtd * m);
    if (q / cand.qtd > Math.max(4, 2 * m0)) continue; // porção exagerada (ex.: 400 g de tofu no lugar do frango)
    const a = porcaoDe(cand, q / cand.qtd);
    const difKcal = Math.abs(a.kcal - kcal0) / Math.max(kcal0, 1);
    const difChave = chave === 'kcal' ? 0 : Math.abs((chave === 'p' ? a.p : chave === 'c' ? a.c : a.g) - alvo0) / Math.max(alvo0, 1);
    if (difKcal > 0.5 || difChave > 0.5) continue;
    out.push({ a, nota: difKcal + difChave });
  }
  return out.sort((x, y) => x.nota - y.nota).slice(0, opts.limite ?? 8).map((x) => x.a);
}

// Reconhece um alimento escrito pelo nutricionista ("Filé de frango grelhado") na tabela do app.
export function identificar(nome: string): Base | null {
  const n = ` ${semAcento(nome).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ')} `;
  let melhor: { a: Base; tam: number } | null = null;
  for (const a of BASE) {
    for (const ap of [semAcento(a.nome), ...(a.apelidos ?? [])]) {
      if (n.includes(` ${ap} `) || n.includes(` ${ap}s `)) {
        if (!melhor || ap.length > melhor.tam) melhor = { a, tam: ap.length };
      }
    }
  }
  return melhor?.a ?? null;
}

// Quantidade na unidade da tabela a partir do texto do plano: "2 fatia(s) (50g)", "150g", "200 ml", "2 Unidade(s) (100g)".
export function quantidadeDoTexto(qtd: string, a: Base): number | null {
  const t = semAcento(qtd).replace(',', '.');
  const g = t.match(/(\d+(?:\.\d+)?)\s*(g|gramas?|ml)\b/);
  const un = t.match(/(\d+(?:\.\d+)?)\s*(unidade|un\b|ovos?)/);
  if (a.un === 'un') {
    if (un) return Number(un[1]);
    if (g) return Math.max(1, Math.round(Number(g[1]) / 50)); // ovo ~50 g
    return null;
  }
  return g ? Number(g[1]) : null;
}

// Trocas que o próprio nutricionista listou para este item ("Opções de substituição para X").
export function trocasDoNutri(item: string, trocas: { de: string; por: string[] }[]): string[] {
  const n = semAcento(item).trim();
  const t = trocas.find((x) => { const d = semAcento(x.de).trim(); return d === n || n.startsWith(d) || d.startsWith(n); });
  return t?.por ?? [];
}
