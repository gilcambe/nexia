// Metas por medida (cintura, braço, coxa...) e quanto falta para cada uma. Puro, para testar.
export interface OpcaoMeta { key: string; label: string; unidade: string; sentido: 1 | -1 }

// sentido: 1 = quer aumentar (músculo), -1 = quer diminuir
export const OPCOES_META: OpcaoMeta[] = [
  { key: 'peso', label: 'Peso', unidade: 'kg', sentido: -1 },
  { key: 'gordura', label: '% de gordura', unidade: '%', sentido: -1 },
  { key: 'cintura', label: 'Cintura', unidade: 'cm', sentido: -1 },
  { key: 'abdomen', label: 'Abdômen', unidade: 'cm', sentido: -1 },
  { key: 'quadril', label: 'Quadril', unidade: 'cm', sentido: -1 },
  { key: 'ombro', label: 'Ombros', unidade: 'cm', sentido: 1 },
  { key: 'torax', label: 'Tórax', unidade: 'cm', sentido: 1 },
  { key: 'braco_contraido', label: 'Braço contraído', unidade: 'cm', sentido: 1 },
  { key: 'coxa_medial', label: 'Coxa', unidade: 'cm', sentido: 1 },
  { key: 'panturrilha', label: 'Panturrilha', unidade: 'cm', sentido: 1 },
];

export type MetasMedidas = Record<string, number>;

export interface ProgressoMeta { key: string; label: string; unidade: string; inicio: number | null; atual: number | null; meta: number; falta: number | null; pct: number; chegou: boolean }

export function progressoMetas(pontos: { m: Record<string, number> }[], metas: MetasMedidas): ProgressoMeta[] {
  return OPCOES_META.filter((o) => metas[o.key] != null).map((o) => {
    const vals = pontos.map((p) => p.m[o.key]).filter((v): v is number => v != null && Number.isFinite(v));
    const meta = metas[o.key];
    const inicio = vals.length ? vals[0] : null;
    const atual = vals.length ? vals[vals.length - 1] : null;
    if (atual == null || inicio == null) return { key: o.key, label: o.label, unidade: o.unidade, inicio, atual, meta, falta: null, pct: 0, chegou: false };
    const sentido = Math.sign(meta - inicio) || o.sentido;
    const falta = Math.round((meta - atual) * 10) / 10;
    const chegou = sentido > 0 ? atual >= meta : atual <= meta;
    const total = meta - inicio;
    const pct = chegou ? 100 : total === 0 ? 0 : Math.max(0, Math.min(100, Math.round(((atual - inicio) / total) * 100)));
    return { key: o.key, label: o.label, unidade: o.unidade, inicio, atual, meta, falta: chegou ? 0 : falta, pct, chegou };
  });
}

// Valores da avaliação com as metas por cima (para o corpo 3D "como vou ficar").
export function valoresDaMeta(valores: Record<string, number>, metas: MetasMedidas): Record<string, number> {
  const out = { ...valores };
  for (const o of OPCOES_META) {
    const v = metas[o.key];
    if (v == null || o.key === 'gordura') continue;
    out[o.key] = v;
    if (o.key === 'braco_contraido') { out.braco_contraido_d = v; delete out.braco_relaxado; delete out.braco_relaxado_d; }
    if (o.key === 'coxa_medial') out.coxa_medial_d = v;
    if (o.key === 'panturrilha') out.panturrilha_d = v;
  }
  return out;
}
