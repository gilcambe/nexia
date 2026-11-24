// Lê, do que o aluno escreveu ou falou, as séries feitas: "fiz 12 com 30 kg", "3x10 40kg no supino",
// "doze repetições com trinta quilos", "12 com 30 e 10 com 35", "4x12: 20/25/30/35".
// Só aceita frase de treino: pergunta, comida (g, kcal) e cardio (min, km) ficam de fora.
import type { CargaRep } from './cargasDoTexto';

export interface SeriesLidas { series: CargaRep[]; exercicio: string | null }

const UNID: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
};
const DEZ: Record<string, number> = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100 };

export const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// "vinte e cinco" → 25, "doze" → 12, "12,5" → 12.5
export function numerosPorExtenso(t: string): string {
  return t
    .replace(/\b(vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa)\s+e\s+(um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove)\b/g, (_, d, u) => String(DEZ[d] + UNID[u]))
    .replace(/\b(vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem)\b/g, (d) => String(DEZ[d]))
    .replace(/\b(uma|um|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezessete|dezoito|dezenove)\b/g, (u) => String(UNID[u]))
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/(\d)\s+e\s+meio\b/g, '$1.5');
}

const POUCO = new Set(['com', 'para', 'pra', 'sem', 'na', 'no', 'de', 'do', 'da', 'em', 'e']);
export function acharExercicio(t: string, nomes: string[]): string | null {
  let melhor: { nome: string; pontos: number } | null = null;
  for (const nome of nomes) {
    const partes = normalizar(nome).split(/[^a-z0-9]+/).filter((p) => p.length >= 4 && !POUCO.has(p));
    if (!partes.length) continue;
    const pontos = partes.filter((p) => new RegExp(`\\b${p}`).test(t)).length;
    // vale se bateu metade das palavras, 2 delas, ou a principal (a primeira: "supino", "agachamento")
    if (!pontos || (pontos < 2 && pontos / partes.length < 0.5 && !new RegExp(`\\b${partes[0]}`).test(t))) continue;
    if (!melhor || pontos > melhor.pontos) melhor = { nome, pontos };
  }
  return melhor?.nome ?? null;
}

const ok = (reps: number, kg: number) => reps >= 1 && reps <= 100 && kg >= 0 && kg <= 500;

function umaParte(p: string, permiteSemKg: boolean): CargaRep[] | null {
  let series = 1;
  const s = /(\d+)\s*series?\b(?:\s*de)?/.exec(p);
  if (s) { series = Number(s[1]); p = p.replace(s[0], ' '); }

  // 4x12: 20/25/30/35 (carga de cada série)
  const prog = /(\d+)\s*x\s*(\d+)\s*(?:\.\.|:|-|–|com|de)?\s*((?:\d+(?:\.\d+)?\s*(?:kg)?\s*\/\s*)+\d+(?:\.\d+)?)/.exec(p);
  if (prog) {
    const n = Number(prog[1]); const reps = Number(prog[2]);
    const cargas = prog[3].split('/').map((x) => parseFloat(x));
    if (n >= 1 && n <= 10 && cargas.every((k) => ok(reps, k))) return Array.from({ length: n }, (_, i) => ({ reps, weight: cargas[Math.min(i, cargas.length - 1)] }));
  }

  const kgM = /(\d+(?:\.\d+)?)\s*(?:kg|kgs|quilos?|kilos?)\b/.exec(p);
  const repsM = /(\d+)\s*(?:reps?|repeticoes|repeticao|vezes)\b/.exec(p);
  let kg = kgM ? Number(kgM[1]) : null;
  let reps = repsM ? Number(repsM[1]) : null;
  let resto = p;
  if (kgM) resto = resto.replace(kgM[0], ' ');
  if (repsM) resto = resto.replace(repsM[0], ' ');

  const x = /(\d+)\s*x\s*(\d+(?:\.\d+)?)/.exec(resto);
  if (x) {
    const a = Number(x[1]); const b = Number(x[2]);
    if (a <= 6 && b <= 30 && reps === null) { series = a; reps = b; } // 3x12 = 3 séries de 12
    else if (reps === null && kg === null) { reps = a; kg = b; } // 12x30 = 12 reps com 30
    resto = resto.replace(x[0], ' ');
  }
  const com = /(\d+)\s*(?:com|de|a)\s*(\d+(?:\.\d+)?)/.exec(resto);
  if (com && reps === null && kg === null) { reps = Number(com[1]); kg = Number(com[2]); }
  else {
    const soltos = [...resto.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
    if (reps === null && kg !== null && soltos.length === 1) reps = soltos[0];
    if (kg === null && reps !== null && soltos.length === 1) kg = soltos[0];
  }
  if (reps !== null && kg === null && (permiteSemKg || /sem peso|peso do corpo|peso corporal/.test(p))) kg = 0;
  if (reps === null || kg === null || !ok(reps, kg) || series < 1 || series > 10) return null;
  return Array.from({ length: series }, () => ({ reps, weight: kg as number }));
}

export function lerSeries(texto: string, nomes: string[] = []): SeriesLidas | null {
  if (!texto || texto.length > 160) return null;
  const t = numerosPorExtenso(normalizar(texto.trim()));
  if (/\?|\b(quanto|quantos|quantas|qual|quais|como|devo|posso|deveria|sera|pode)\b/.test(t)) return null;
  const temKg = /\d\s*(?:kg|kgs|quilos?|kilos?)\b/.test(t);
  const temReps = /\d\s*(?:reps?|repeticoes|repeticao|vezes)\b/.test(t);
  const temVerbo = /\b(fiz|fez|feito|anota|anote|registra|registre|completei|consegui|bati|mandei)\b/.test(t);
  const temX = /\d\s*x\s*\d/.test(t) || /\b\d+\s+com\s+\d+/.test(t);
  if (!temKg && !temReps && !temVerbo && !temX) return null;
  if (!temKg && /\d\s*(?:g|gr|gramas|ml|kcal|cal|calorias|min|minutos|km|h|horas|segundos|s)\b/.test(t)) return null;

  const exercicio = acharExercicio(t, nomes);
  const partes = t.split(/\s*(?:,|;|\be\b|\bdepois\b)\s*/).filter((x) => /\d/.test(x));
  const series: CargaRep[] = [];
  for (const p of partes.length ? partes : [t]) {
    const r = umaParte(p, temVerbo && temReps);
    if (!r) { if (partes.length > 1 && series.length) continue; return series.length ? { series, exercicio } : null; }
    series.push(...r);
  }
  return series.length ? { series, exercicio } : null;
}
