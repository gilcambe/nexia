// Registro de refeição em 1 toque: "repetir ontem" e leitura da estimativa que a IA devolve para a foto.
export interface RefeicaoBase { name: string; time?: string; calories: number; protein: number; carbs: number; fat: number; fiber?: number; created_at?: string }
export interface Estimativa { calorias: number; proteinas: number; carboidratos: number; gorduras: number }

const dia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Refeições lançadas ontem (pela data local), na ordem do horário.
export function refeicoesDeOntem<T extends RefeicaoBase>(todas: T[], agora = new Date()): T[] {
  const ontem = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1);
  const alvo = dia(ontem);
  return todas
    .filter((m) => typeof m.created_at === 'string' && dia(new Date(m.created_at)) === alvo)
    .sort((a, b) => String(a.time ?? '').localeCompare(String(b.time ?? '')));
}

// Pede à IA uma última linha fixa para virar números editáveis.
export const PEDIDO_ESTIMATIVA = 'No fim, escreva uma linha exatamente assim: ESTIMATIVA: kcal=NUM; proteina=NUM; carbo=NUM; gordura=NUM';

const num = (re: RegExp, t: string) => {
  const m = t.match(re);
  return m ? Math.max(0, Math.round(Number(m[1].replace(',', '.')))) : NaN;
};

// Lê a linha "ESTIMATIVA:" da resposta; devolve null se não vier ou vier sem calorias.
export function lerEstimativa(texto: string | null | undefined): Estimativa | null {
  if (!texto) return null;
  const linha = texto.split('\n').reverse().find((l) => /estimativa\s*:/i.test(l));
  if (!linha) return null;
  const calorias = num(/kcal\s*=\s*([\d.,]+)/i, linha);
  if (!(calorias > 0)) return null;
  const v = (re: RegExp) => { const n = num(re, linha); return Number.isFinite(n) ? n : 0; };
  return { calorias, proteinas: v(/prote[ií]na\s*=\s*([\d.,]+)/i), carboidratos: v(/carbo\w*\s*=\s*([\d.,]+)/i), gorduras: v(/gordura\s*=\s*([\d.,]+)/i) };
}

// Tira a linha técnica do texto mostrado à pessoa.
export const semLinhaEstimativa = (texto: string) => texto.split('\n').filter((l) => !/^\s*estimativa\s*:/i.test(l)).join('\n').trim();
