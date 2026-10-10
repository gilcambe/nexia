// Medidas do corpo para o boneco 3D: usa as circunferências reais da avaliação e completa as que
// faltarem com proporções médias pela altura, sexo e IMC. Puro (sem three.js) para poder testar.
import type { Sexo } from './calculos.ts';

export interface MedidasCorpo {
  altura: number; // m
  sexo: Sexo;
  // circunferências em cm
  pescoco: number;
  ombro: number;
  torax: number;
  cintura: number;
  abdomen: number;
  quadril: number;
  braco: number;
  antebraco: number;
  coxa: number;
  panturrilha: number;
  estimadas: string[];
}

// Circunferência média como fração da altura (adultos), ajustada pelo IMC.
const PROP: Record<Sexo, Record<string, number>> = {
  M: { pescoco: 0.225, ombro: 0.66, torax: 0.57, cintura: 0.48, abdomen: 0.5, quadril: 0.56, braco: 0.185, antebraco: 0.16, coxa: 0.32, panturrilha: 0.215 },
  F: { pescoco: 0.2, ombro: 0.6, torax: 0.53, cintura: 0.43, abdomen: 0.47, quadril: 0.58, braco: 0.17, antebraco: 0.145, coxa: 0.34, panturrilha: 0.21 },
};

const ORIGEM: Record<string, string[]> = {
  pescoco: ['pescoco'],
  ombro: ['ombro'],
  torax: ['torax'],
  cintura: ['cintura'],
  abdomen: ['abdomen', 'cintura'],
  quadril: ['quadril'],
  braco: ['braco_relaxado', 'braco_relaxado_d', 'braco_contraido', 'braco_contraido_d'],
  antebraco: ['antebraco', 'antebraco_d'],
  coxa: ['coxa_medial', 'coxa_medial_d', 'coxa_proximal', 'coxa_proximal_d'],
  panturrilha: ['panturrilha', 'panturrilha_d'],
};

export function medidasDoCorpo(v: Record<string, number>, sexo: Sexo | null | undefined, alturaPerfil?: number | null): MedidasCorpo {
  const s: Sexo = sexo ?? 'M';
  const alturaCm = v.altura ?? alturaPerfil ?? (s === 'M' ? 175 : 162);
  const peso = v.peso ?? 22 * (alturaCm / 100) ** 2;
  const fator = Math.sqrt(Math.min(45, Math.max(16, peso / (alturaCm / 100) ** 2)) / 22);
  const estimadas: string[] = [];
  const out: Record<string, number> = {};
  const primeiro = (ks: string[]) => ks.map((f) => v[f]).find((n) => n != null && Number.isFinite(n));
  for (const [k, fontes] of Object.entries(ORIGEM)) {
    let val = primeiro(fontes.slice(0, 2));
    // Braço contraído e coxa proximal são maiores que o relaxado / a medial.
    if (val == null && fontes.length > 2) {
      const alt = primeiro(fontes.slice(2));
      if (alt != null) val = alt * (k === 'braco' ? 0.94 : 0.92);
    }
    if (val == null) {
      const ajuste = ['pescoco', 'ombro'].includes(k) ? Math.sqrt(fator) : fator;
      val = PROP[s][k] * alturaCm * ajuste;
      estimadas.push(k);
    }
    out[k] = Math.round(val * 10) / 10;
  }
  return { altura: alturaCm / 100, sexo: s, ...(out as Omit<MedidasCorpo, 'altura' | 'sexo' | 'estimadas'>), estimadas };
}

// Semiaxes de uma elipse (largura a, profundidade a*razao) com o perímetro dado (Ramanujan).
export function elipse(perimetroCm: number, razao: number): [number, number] {
  const k = Math.PI * (3 * (1 + razao) - Math.sqrt((3 + razao) * (1 + 3 * razao)));
  const a = perimetroCm / 100 / k;
  return [a, a * razao];
}

export type Regiao = 'ombros' | 'peito' | 'abdomen' | 'quadril' | 'braco' | 'antebraco' | 'coxa' | 'panturrilha';

// Cor de cada região pelo que mudou entre duas avaliações: verde melhorou, laranja piorou.
export function mapaMelhora(antes: Record<string, number>, depois: Record<string, number>): Partial<Record<Regiao, 'melhorou' | 'piorou' | 'igual'>> {
  const regras: [Regiao, string[], 1 | -1][] = [
    ['ombros', ['ombro'], 1],
    ['peito', ['torax'], 1],
    ['abdomen', ['abdomen', 'cintura', 'abdominal'], -1],
    ['quadril', ['quadril', 'suprailiaca'], -1],
    ['braco', ['braco_contraido', 'braco_relaxado', 'cmb'], 1],
    ['antebraco', ['antebraco'], 1],
    ['coxa', ['coxa_medial', 'coxa_proximal'], 1],
    ['panturrilha', ['panturrilha'], 1],
  ];
  const out: Partial<Record<Regiao, 'melhorou' | 'piorou' | 'igual'>> = {};
  for (const [reg, keys, sentido] of regras) {
    const k = keys.find((x) => antes[x] != null && depois[x] != null);
    if (!k) continue;
    const d = depois[k] - antes[k];
    out[reg] = Math.abs(d) < 0.3 ? 'igual' : Math.sign(d) === sentido ? 'melhorou' : 'piorou';
  }
  return out;
}

// Séries da semana por grupo muscular → região do boneco.
export function mapaVolume(volume: Record<string, number>): Partial<Record<Regiao, number>> {
  const g = (k: string) => volume[k] ?? 0;
  return {
    ombros: g('ombros'),
    peito: g('peito') + g('costas'),
    abdomen: g('abdomen'),
    quadril: g('gluteos'),
    braco: g('biceps') + g('triceps'),
    antebraco: Math.round((g('biceps') + g('triceps')) / 2),
    coxa: g('quadriceps') + g('posterior'),
    panturrilha: g('panturrilha'),
  };
}
