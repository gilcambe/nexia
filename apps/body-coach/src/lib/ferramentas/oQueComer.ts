// "O que comer agora": monta até 3 combinações com o que falta de proteína, carboidrato e calorias no dia.
import { BASE, porcaoDe, restricoes, type Alimento } from '../dietPlan';

export interface Falta { kcal: number; p: number; c: number; g: number }
export interface Sugestao { itens: Alimento[]; kcal: number; p: number; c: number; g: number }

const meio = (n: number) => Math.round(n * 2) / 2;
const limita = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

export function sugerirRefeicao(falta: Falta, ob: Record<string, unknown> = {}, evitar: string[] = [], hora = new Date().getHours()): Sugestao[] {
  if (falta.kcal < 80) return [];
  const proibidas = restricoes(ob);
  const ok = (id: string) => !evitar.includes(id) && !BASE.find((x) => x.id === id)?.evita.some((t) => proibidas.has(t));
  const lanche = hora < 11 || (hora >= 15 && hora < 19) || hora >= 21;
  const prots = BASE.filter((x) => ok(x.id) && x.grupos.some((g) => (lanche ? g === 'prot_leve' : g === 'prot')));
  const carbs = BASE.filter((x) => ok(x.id) && x.grupos.some((g) => (lanche ? g === 'carbo_cafe' || g === 'fruta' : g === 'carbo')));
  const out: Sugestao[] = [];
  const alvoP = limita(falta.p, 0, 45);
  for (let i = 0; i < prots.length && out.length < 6; i++) {
    const P = prots[i];
    const itens: Alimento[] = [];
    if (alvoP >= 8) itens.push(porcaoDe(P, limita(meio(alvoP / Math.max(P.p, 1)), 0.5, 3)));
    const usadoKcal = itens.reduce((s, a) => s + a.kcal, 0);
    const C = carbs[(i * 2) % Math.max(1, carbs.length)];
    const restaC = falta.c - itens.reduce((s, a) => s + a.c, 0);
    if (C && restaC > 15 && falta.kcal - usadoKcal > 100) {
      const mult = limita(meio(Math.min(restaC, 70) / Math.max(C.c, 1)), 0.5, 3);
      const a = porcaoDe(C, mult);
      if (usadoKcal + a.kcal <= falta.kcal + 80) itens.push(a);
    }
    if (!itens.length) continue;
    const soma = (k: 'kcal' | 'p' | 'c' | 'g') => Math.round(itens.reduce((s, a) => s + a[k], 0));
    const sug = { itens, kcal: soma('kcal'), p: soma('p'), c: soma('c'), g: soma('g') };
    if (sug.kcal <= falta.kcal + 120) out.push(sug);
  }
  // Prioriza quem chega mais perto da proteína que falta sem passar das calorias.
  return out.sort((a, b) => Math.abs(alvoP - a.p) - Math.abs(alvoP - b.p)).slice(0, 3);
}
