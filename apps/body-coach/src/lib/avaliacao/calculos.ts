// Cálculos da avaliação física: protocolos de dobras, composição corporal, classificações,
// comparação entre datas, previsão, recordes e alertas. Tudo puro (sem navegador, sem banco).
// Conferido com um laudo real: 7 dobras somando 42 mm, homem de 40 anos, 84,7 kg →
// densidade 1,083 g/mL, 7,7% de gordura (Jackson & Pollock 7 dobras + Brozek), CMB 34,1 cm.
import { CAMPO_POR_KEY } from './campos.ts';

export type Sexo = 'M' | 'F';
export type Protocolo = 'auto' | 'jp7' | 'jp3' | 'guedes';
export type Segmento = 'tronco' | 'braco_e' | 'braco_d' | 'perna_e' | 'perna_d';

export interface Segmental {
  musculo_kg?: Partial<Record<Segmento, number>>;
  gordura_pct?: Partial<Record<Segmento, number>>;
  gordura_kg?: Partial<Record<Segmento, number>>;
}

export interface Avaliacao {
  data: string; // AAAA-MM-DD
  hora?: string | null; // HH:MM
  sexo?: Sexo | null;
  valores: Record<string, number>;
  segmental?: Segmental | null;
  protocolo?: Protocolo;
  fonte?: string | null;
  notas?: string | null;
}

export interface Resultado {
  imc: number | null;
  imcClasse: string | null;
  rcq: number | null;
  rcqRisco: string | null;
  cmb: number | null;
  cmbClasse: string | null;
  somaDobras: number | null;
  protocolo: Exclude<Protocolo, 'auto'> | null;
  densidade: number | null;
  gorduraDobras: number | null;
  gorduraBio: number | null;
  gordura: number | null; // a principal: dobras quando houver, senão balança
  gorduraClasse: string | null;
  massaGorda: number | null;
  mlg: number | null;
  massaResidual: number | null;
  tmb: number | null;
  aguaLitros: number | null;
  pesoSaudavel: [number, number] | null;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const temTodos = (v: Record<string, number>, ks: string[]) => ks.every((k) => Number.isFinite(v[k]) && v[k] > 0);
const soma = (v: Record<string, number>, ks: string[]) => ks.reduce((a, k) => a + v[k], 0);

export const DOBRAS_PROTOCOLO: Record<Exclude<Protocolo, 'auto'>, { nome: string; M: string[]; F: string[] }> = {
  jp7: {
    nome: 'Jackson & Pollock (7 dobras)',
    M: ['peitoral', 'axilar_media', 'tricipital', 'subescapular', 'abdominal', 'suprailiaca', 'coxa'],
    F: ['peitoral', 'axilar_media', 'tricipital', 'subescapular', 'abdominal', 'suprailiaca', 'coxa'],
  },
  jp3: {
    nome: 'Jackson & Pollock (3 dobras)',
    M: ['peitoral', 'abdominal', 'coxa'],
    F: ['tricipital', 'suprailiaca', 'coxa'],
  },
  guedes: {
    nome: 'Guedes (3 dobras)',
    M: ['tricipital', 'suprailiaca', 'abdominal'],
    F: ['subescapular', 'suprailiaca', 'coxa'],
  },
};

function densidadePor(p: Exclude<Protocolo, 'auto'>, sexo: Sexo, s: number, idade: number): number {
  if (p === 'jp7') {
    return sexo === 'M'
      ? 1.112 - 0.00043499 * s + 0.00000055 * s * s - 0.00028826 * idade
      : 1.097 - 0.00046971 * s + 0.00000056 * s * s - 0.00012828 * idade;
  }
  if (p === 'jp3') {
    return sexo === 'M'
      ? 1.10938 - 0.0008267 * s + 0.0000016 * s * s - 0.0002574 * idade
      : 1.0994921 - 0.0009929 * s + 0.0000023 * s * s - 0.0001392 * idade;
  }
  return sexo === 'M' ? 1.17136 - 0.06706 * Math.log10(s) : 1.1665 - 0.07063 * Math.log10(s);
}

export function escolherProtocolo(v: Record<string, number>, sexo: Sexo, pedido: Protocolo = 'auto'): Exclude<Protocolo, 'auto'> | null {
  const ordem: Exclude<Protocolo, 'auto'>[] = pedido === 'auto' ? ['jp7', 'jp3', 'guedes'] : [pedido];
  for (const p of ordem) if (temTodos(v, DOBRAS_PROTOCOLO[p][sexo])) return p;
  return null;
}

export function classeImc(imc: number): string {
  if (imc < 18.5) return 'Abaixo do peso';
  if (imc < 25) return 'Peso normal';
  if (imc < 30) return 'Sobrepeso';
  if (imc < 35) return 'Obesidade grau 1';
  if (imc < 40) return 'Obesidade grau 2';
  return 'Obesidade grau 3';
}

// Risco pela relação cintura/quadril (Bray & Gray, por sexo e idade).
const RCQ: Record<Sexo, [number, number[]][]> = {
  M: [[29, [0.83, 0.88, 0.94]], [39, [0.84, 0.91, 0.96]], [49, [0.88, 0.95, 1.0]], [59, [0.9, 0.96, 1.02]], [200, [0.91, 0.98, 1.03]]],
  F: [[29, [0.71, 0.77, 0.82]], [39, [0.72, 0.78, 0.84]], [49, [0.73, 0.79, 0.87]], [59, [0.74, 0.81, 0.88]], [200, [0.76, 0.83, 0.9]]],
};
export function riscoRcq(rcq: number, sexo: Sexo, idade: number): string {
  const [, lim] = RCQ[sexo].find(([ate]) => idade <= ate) ?? RCQ[sexo][RCQ[sexo].length - 1];
  if (rcq < lim[0]) return 'Baixo';
  if (rcq <= lim[1]) return 'Moderado';
  if (rcq <= lim[2]) return 'Alto';
  return 'Muito alto';
}

// % de gordura (Pollock & Wilmore): limite superior de cada faixa por sexo e idade.
// Abaixo do mínimo da faixa "Excelente" a gordura é classificada como "Baixa".
const GORDURA: Record<Sexo, [number, number, number[]][]> = {
  M: [
    [25, 4, [6, 10, 13, 16, 20, 24]],
    [35, 8, [11, 15, 18, 20, 24, 27]],
    [45, 10, [14, 18, 21, 23, 25, 29]],
    [55, 12, [16, 20, 23, 25, 27, 30]],
    [200, 15, [18, 21, 23, 25, 27, 30]],
  ],
  F: [
    [25, 13, [16, 19, 22, 25, 28, 31]],
    [35, 14, [16, 20, 23, 25, 29, 33]],
    [45, 16, [19, 23, 26, 29, 32, 36]],
    [55, 17, [21, 25, 28, 31, 34, 38]],
    [200, 18, [22, 26, 29, 32, 35, 38]],
  ],
};
const NOMES_GORDURA = ['Excelente', 'Bom', 'Acima da média', 'Média', 'Abaixo da média', 'Ruim'];
export function classeGordura(pct: number, sexo: Sexo, idade: number): string {
  const [, minimo, lim] = GORDURA[sexo].find(([ate]) => idade <= ate) ?? GORDURA[sexo][GORDURA[sexo].length - 1];
  if (pct < minimo) return 'Baixa';
  for (let i = 0; i < lim.length; i += 1) if (pct <= lim[i]) return NOMES_GORDURA[i];
  return 'Muito ruim';
}

// Adequação da circunferência muscular do braço (CMB / padrão de Jelliffe).
export function classeCmb(cmb: number, sexo: Sexo): string {
  const pct = (cmb / (sexo === 'M' ? 25.3 : 23.2)) * 100;
  if (pct >= 90) return 'Adequado';
  if (pct >= 80) return 'Depleção leve';
  if (pct >= 70) return 'Depleção moderada';
  return 'Depleção grave';
}

export function calcular(av: Avaliacao, extra: { sexo?: Sexo | null; idade?: number | null; altura?: number | null } = {}): Resultado {
  const v = av.valores ?? {};
  const sexo: Sexo = av.sexo ?? extra.sexo ?? 'M';
  const idade = v.idade ?? extra.idade ?? 30;
  const altura = v.altura ?? extra.altura ?? null;
  const peso = v.peso ?? null;

  const imc = peso && altura ? r1(peso / (altura / 100) ** 2) : v.imc_aparelho ?? null;
  const rcq = v.cintura && v.quadril ? r2(v.cintura / v.quadril) : null;
  const braco = v.braco_relaxado ?? v.braco_relaxado_d ?? null;
  const cmb = braco && v.tricipital ? r1(braco - Math.PI * (v.tricipital / 10)) : null;

  const protocolo = escolherProtocolo(v, sexo, av.protocolo ?? 'auto');
  const somaDobras = protocolo ? soma(v, DOBRAS_PROTOCOLO[protocolo][sexo]) : null;
  const densidade = protocolo && somaDobras ? r3(densidadePor(protocolo, sexo, somaDobras, idade)) : null;
  // Brozek (1963): é a conversão que bate com os laudos de nutricionista brasileiros.
  const gorduraDobras = protocolo && somaDobras
    ? r1(457 / densidadePor(protocolo, sexo, somaDobras, idade) - 414.2)
    : null;
  const gorduraBio = v.gordura_pct ?? (v.massa_gorda && peso ? r1((v.massa_gorda / peso) * 100) : null);
  const gordura = gorduraDobras ?? gorduraBio ?? v.gordura_pct_laudo ?? null;

  const massaGorda = gordura != null && peso ? r1((peso * gordura) / 100) : v.massa_gorda ?? null;
  const mlg = massaGorda != null && peso ? r1(peso - massaGorda) : v.mlg ?? null;
  const massaResidual = peso ? r1(peso * (sexo === 'M' ? 0.241 : 0.209)) : null;
  const tmb = v.tmb ?? (mlg ? Math.round(370 + 21.6 * mlg) : null); // Katch-McArdle
  const aguaLitros = peso ? r1((peso * 35) / 1000) : null;
  const pesoSaudavel: [number, number] | null = altura ? [r1(18.5 * (altura / 100) ** 2), r1(24.9 * (altura / 100) ** 2)] : null;

  return {
    imc,
    imcClasse: imc ? classeImc(imc) : null,
    rcq,
    rcqRisco: rcq ? riscoRcq(rcq, sexo, idade) : null,
    cmb,
    cmbClasse: cmb ? classeCmb(cmb, sexo) : null,
    somaDobras,
    protocolo,
    densidade,
    gorduraDobras,
    gorduraBio,
    gordura,
    gorduraClasse: gordura != null ? classeGordura(gordura, sexo, idade) : null,
    massaGorda,
    mlg,
    massaResidual,
    tmb,
    aguaLitros,
    pesoSaudavel,
  };
}

// ── Métricas para tabelas e gráficos ────────────────────────────────
export interface Metrica {
  key: string;
  label: string;
  unidade: string;
  // 1 = subir é bom, -1 = descer é bom, 0 = depende do objetivo.
  sentido: 1 | -1 | 0;
}

export const METRICAS_DERIVADAS: Metrica[] = [
  { key: 'peso', label: 'Peso', unidade: 'kg', sentido: 0 },
  { key: 'gordura', label: '% de gordura', unidade: '%', sentido: -1 },
  { key: 'gorduraDobras', label: '% gordura (dobras)', unidade: '%', sentido: -1 },
  { key: 'gorduraBio', label: '% gordura (balança)', unidade: '%', sentido: -1 },
  { key: 'massaGorda', label: 'Massa de gordura', unidade: 'kg', sentido: -1 },
  { key: 'mlg', label: 'Massa magra (livre de gordura)', unidade: 'kg', sentido: 1 },
  { key: 'massa_muscular', label: 'Massa muscular (balança)', unidade: 'kg', sentido: 1 },
  { key: 'smm', label: 'Músculo esquelético', unidade: 'kg', sentido: 1 },
  { key: 'imc', label: 'IMC', unidade: 'kg/m²', sentido: 0 },
  { key: 'somaDobras', label: 'Soma das dobras', unidade: 'mm', sentido: -1 },
  { key: 'rcq', label: 'Relação cintura/quadril', unidade: '', sentido: -1 },
  { key: 'cmb', label: 'Músculo do braço (CMB)', unidade: 'cm', sentido: 1 },
  { key: 'visceral', label: 'Gordura visceral', unidade: 'nível', sentido: -1 },
  { key: 'agua_kg', label: 'Água corporal', unidade: 'kg', sentido: 1 },
  { key: 'idade_metabolica', label: 'Idade metabólica', unidade: 'anos', sentido: -1 },
  { key: 'tmb', label: 'Metabolismo basal', unidade: 'kcal', sentido: 1 },
];

const SENTIDO_CIRC: Record<string, 1 | -1 | 0> = {
  cintura: -1, abdomen: -1, quadril: -1, pescoco: 0, torax: 0, ombro: 1,
};

export function metricaInfo(key: string): Metrica | null {
  const d = METRICAS_DERIVADAS.find((m) => m.key === key);
  if (d) return d;
  const campo = CAMPO_POR_KEY[key];
  if (!campo) return null;
  let sentido: 1 | -1 | 0 = 0;
  if (campo.grupo === 'dobras') sentido = -1;
  else if (campo.grupo === 'circ') sentido = SENTIDO_CIRC[key] ?? 1;
  return { key, label: campo.label, unidade: campo.unidade, sentido };
}

// Todas as métricas de uma avaliação num só mapa (medidas + calculadas).
export function achatar(av: Avaliacao, res: Resultado): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(av.valores ?? {})) if (Number.isFinite(n)) out[k] = n;
  for (const m of METRICAS_DERIVADAS) {
    const val = (res as unknown as Record<string, unknown>)[m.key];
    if (typeof val === 'number' && Number.isFinite(val)) out[m.key] = val;
  }
  return out;
}

export interface Variacao {
  key: string;
  antes: number | null;
  depois: number | null;
  delta: number | null;
  // 'bom' | 'ruim' | 'neutro' segundo o sentido da métrica.
  leitura: 'bom' | 'ruim' | 'neutro';
}

export function comparar(antes: Record<string, number>, depois: Record<string, number>, keys?: string[]): Variacao[] {
  const todas = keys ?? Array.from(new Set([...Object.keys(antes), ...Object.keys(depois)]));
  return todas.map((key) => {
    const a = antes[key] ?? null;
    const d = depois[key] ?? null;
    const delta = a != null && d != null ? Math.round((d - a) * 100) / 100 : null;
    const sentido = metricaInfo(key)?.sentido ?? 0;
    let leitura: Variacao['leitura'] = 'neutro';
    if (delta && sentido) leitura = Math.sign(delta) === sentido ? 'bom' : 'ruim';
    return { key, antes: a, depois: d, delta, leitura };
  });
}

// ── Previsão, recordes e alertas ────────────────────────────────────
export interface Ponto { data: string; valor: number }

const DIA = 24 * 3600 * 1000;
const tempo = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00`).getTime();

// Reta pelos pontos (mínimos quadrados): quanto muda por semana e quando chega na meta.
export function prever(pontos: Ponto[], meta: number | null): { porSemana: number; semanas: number | null; dataMeta: string | null } | null {
  if (pontos.length < 2) return null;
  const xs = pontos.map((p) => tempo(p.data) / (7 * DIA));
  const ys = pontos.map((p) => p.valor);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (!den) return null;
  const inclinacao = num / den;
  const porSemana = Math.round(inclinacao * 100) / 100;
  if (meta == null || !inclinacao) return { porSemana, semanas: null, dataMeta: null };
  const ultimo = ys[ys.length - 1];
  const falta = meta - ultimo;
  if (falta === 0 || Math.sign(falta) !== Math.sign(inclinacao)) return { porSemana, semanas: null, dataMeta: null };
  const semanas = Math.ceil(falta / inclinacao);
  if (semanas > 260) return { porSemana, semanas: null, dataMeta: null };
  const dt = new Date(tempo(pontos[pontos.length - 1].data) + semanas * 7 * DIA);
  return { porSemana, semanas, dataMeta: dt.toISOString().slice(0, 10) };
}

export interface Recorde { key: string; label: string; valor: number; unidade: string; data: string; novo: boolean }

// Melhor marca de cada métrica com sentido definido; "novo" quando é da avaliação mais recente.
export function recordes(serie: { data: string; m: Record<string, number> }[]): Recorde[] {
  if (serie.length < 2) return [];
  const keys = ['gordura', 'cintura', 'abdomen', 'massaGorda', 'somaDobras', 'mlg', 'massa_muscular', 'braco_contraido', 'braco_relaxado', 'coxa_medial', 'cmb'];
  const ultima = serie[serie.length - 1].data;
  const out: Recorde[] = [];
  for (const key of keys) {
    const info = metricaInfo(key);
    if (!info || !info.sentido) continue;
    if (serie.filter((s) => s.m[key] != null).length < 2) continue;
    let melhor: { valor: number; data: string } | null = null;
    for (const s of serie) {
      const val = s.m[key];
      if (val == null) continue;
      if (!melhor || (info.sentido > 0 ? val > melhor.valor : val < melhor.valor)) melhor = { valor: val, data: s.data };
    }
    if (melhor) out.push({ key, label: info.label, unidade: info.unidade, valor: melhor.valor, data: melhor.data, novo: melhor.data === ultima });
  }
  return out;
}

export interface Alerta { nivel: 'atencao' | 'bom'; texto: string }

// Compara as duas últimas avaliações e avisa quando a mudança é rápida demais.
export function alertas(serie: { data: string; m: Record<string, number> }[]): Alerta[] {
  if (serie.length < 2) return [];
  const a = serie[serie.length - 2];
  const b = serie[serie.length - 1];
  const semanas = Math.max(1, (tempo(b.data) - tempo(a.data)) / (7 * DIA));
  const meses = semanas / 4.345;
  const out: Alerta[] = [];
  const d = (k: string) => (a.m[k] != null && b.m[k] != null ? b.m[k] - a.m[k] : null);

  const magra = d('mlg') ?? d('massa_muscular');
  const baseMagra = a.m.mlg ?? a.m.massa_muscular;
  if (magra != null && baseMagra && magra / baseMagra / meses < -0.015) {
    out.push({ nivel: 'atencao', texto: `Perda de massa magra: ${fmt(magra)} kg desde ${dataBr(a.data)}. Vale revisar proteína, calorias e treino de força.` });
  }
  const gorda = d('massaGorda');
  if (gorda != null && gorda / meses > 1) {
    out.push({ nivel: 'atencao', texto: `Ganho de gordura rápido: +${fmt(gorda)} kg desde ${dataBr(a.data)}.` });
  }
  const peso = d('peso');
  if (peso != null && a.m.peso && peso / a.m.peso / semanas < -0.01) {
    out.push({ nivel: 'atencao', texto: `Peso caindo mais de 1% por semana (${fmt(peso)} kg). Rápido demais costuma levar músculo junto.` });
  }
  if (gorda != null && gorda < 0 && magra != null && magra >= 0) {
    out.push({ nivel: 'bom', texto: `Recomposição: ${fmt(gorda)} kg de gordura e ${magra >= 0 ? '+' : ''}${fmt(magra)} kg de massa magra.` });
  }
  return out;
}

const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString('pt-BR');
export const dataBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
