// Plano alimentar do nutricionista: lê o PDF exportado pelos sistemas de nutrição (ex.: o
// "Planejamento alimentar" com horários, quantidades, substituições, observações e o relatório
// de nutrientes) e devolve as refeições organizadas. Puro: quem lê o PDF (pdf.js) é lerPlanoPdf.

export interface TextoPdf { str: string; x: number; y: number } // y de cima para baixo
export interface ItemPlano { nome: string; qtd: string }
export interface TrocaPlano { de: string; por: string[] }
export interface Macros { proteina: number; gordura: number; carbo: number; kcal: number }
export interface RefeicaoPlano {
  horario: string | null;
  nome: string;
  itens: ItemPlano[];
  trocas: TrocaPlano[];
  obs: string[];
  macros: Macros | null;
}
export interface PlanoAlimentar {
  arquivo: string;
  importado_em: string;
  refeicoes: RefeicaoPlano[];
  totais: Macros | null;
  extras: { titulo: string; texto: string[] }[];
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const SEP = /^-\s*ou\s*-$/i;
const HORA = /^(\d{1,2}:\d{2})\s*-\s*(.+)$/;
const EXTRAS = ['lista de frutas', 'suplementacao', 'legumes e folhas', 'orientacoes', 'orientacoes gerais', 'dicas'];
const FIM = ['total de vitaminas', 'lista de compras'];
const IGNORAR = ['todos os dias', 'planejamento alimentar'];

// Junta os pedaços de texto em linhas (mesma altura) e, dentro da linha, em células (pedaços próximos).
export function emLinhasPlano(paginas: { itens: TextoPdf[] }[]): { x: number; celulas: string[] }[] {
  const out: { x: number; celulas: string[] }[] = [];
  for (const p of paginas) {
    const its = p.itens.filter((t) => t.str.trim()).sort((a, b) => a.y - b.y || a.x - b.x);
    let linha: TextoPdf[] = [];
    const fechar = () => {
      if (!linha.length) return;
      linha.sort((a, b) => a.x - b.x);
      out.push({ x: linha[0].x, celulas: linha.map((t) => t.str.trim()) });
      linha = [];
    };
    for (const t of its) {
      if (linha.length && Math.abs(t.y - linha[0].y) > 2) fechar();
      linha.push(t);
    }
    fechar();
  }
  return out;
}

const num = (s: string) => {
  const m = s.replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
};

export function lerPlano(paginas: { itens: TextoPdf[]; largura: number }[], arquivo = '', agora = new Date().toISOString()): PlanoAlimentar {
  const largura = paginas[0]?.largura || 595;
  const linhas = emLinhasPlano(paginas);
  const refeicoes: RefeicaoPlano[] = [];
  const extras: PlanoAlimentar['extras'] = [];
  let totais: Macros | null = null;
  const macrosLidos: { nome: string; m: Macros }[] = [];
  let modo: 'plano' | 'troca' | 'obs' | 'extra' | 'nutrientes' | 'fim' = 'plano';
  let atual: RefeicaoPlano | null = null;
  let troca: TrocaPlano | null = null;
  let continua = false; // a última opção de troca terminou sem "- ou -": a linha seguinte continua o texto

  for (const { x, celulas } of linhas) {
    const texto = celulas.join(' ').replace(/\s+/g, ' ').trim();
    const n = norm(texto);
    const centro = celulas.length === 1 && x > largura * 0.2;
    if (modo === 'fim') break;

    if (centro && FIM.some((f) => n.startsWith(f))) { modo = 'fim'; continue; }
    if (centro && n.startsWith('relatorio de nutrientes')) { modo = 'nutrientes'; continue; }
    if (centro && EXTRAS.includes(n)) { modo = 'extra'; extras.push({ titulo: texto, texto: [] }); continue; }
    if (centro && IGNORAR.includes(n)) continue;

    if (modo === 'nutrientes') {
      if (celulas.length >= 5 && /kcal/i.test(celulas[celulas.length - 1])) {
        const [p, g, c, k] = celulas.slice(-4).map(num);
        const nome = celulas.slice(0, -4).join(' ');
        const m = { proteina: p, gordura: g, carbo: c, kcal: k };
        if (norm(nome).startsWith('total')) totais = m;
        else macrosLidos.push({ nome, m });
      }
      continue;
    }
    if (modo === 'extra') {
      extras[extras.length - 1].texto.push(texto);
      continue;
    }

    // Cabeçalho de refeição: linha única centralizada ("13:00 - Almoço", "Horário do treino").
    if (centro && !texto.startsWith('•')) {
      const h = texto.match(HORA);
      atual = { horario: h ? h[1].padStart(5, '0') : null, nome: h ? h[2].trim() : texto, itens: [], trocas: [], obs: [], macros: null };
      refeicoes.push(atual);
      modo = 'plano'; troca = null;
      continue;
    }
    if (!atual) continue;

    const t = texto.match(/^•\s*op[cç][oõ]es de substitui[cç][aã]o para (.+?):?$/i);
    if (t) {
      troca = { de: t[1].trim(), por: [] };
      atual.trocas.push(troca);
      modo = 'troca'; continua = false;
      continue;
    }
    if (/^observa[cç][oõ]es:?$/i.test(texto)) { modo = 'obs'; continue; }

    if (modo === 'troca' && troca) {
      let nova = !continua || !troca.por.length;
      for (const c of celulas) {
        if (SEP.test(c)) { nova = true; continue; }
        if (nova) troca.por.push(c.replace(/\s*-\s*$/, '').trim());
        else troca.por[troca.por.length - 1] = `${troca.por[troca.por.length - 1].replace(/\s*-\s*$/, '')} - ${c}`.trim();
        nova = false;
      }
      continua = !SEP.test(celulas[celulas.length - 1]);
      continue;
    }
    if (modo === 'obs') { atual.obs.push(texto); continue; }
    if (celulas.length >= 2) atual.itens.push({ nome: celulas[0], qtd: celulas.slice(1).join(' ') });
    else atual.itens.push({ nome: texto, qtd: '' });
  }

  // O relatório de nutrientes vem na mesma ordem das refeições.
  let i = 0;
  for (const { nome, m } of macrosLidos) {
    const j = refeicoes.findIndex((r, k) => k >= i && norm(r.nome) === norm(nome));
    if (j >= 0) { refeicoes[j].macros = m; i = j + 1; }
  }
  if (!totais && macrosLidos.length) {
    totais = macrosLidos.reduce((a, { m }) => ({ proteina: a.proteina + m.proteina, gordura: a.gordura + m.gordura, carbo: a.carbo + m.carbo, kcal: a.kcal + m.kcal }), { proteina: 0, gordura: 0, carbo: 0, kcal: 0 });
  }
  return { arquivo, importado_em: agora, refeicoes: refeicoes.filter((r) => r.itens.length), totais, extras: extras.filter((e) => e.texto.length) };
}

// Metas do dia a partir do plano (o que o nutricionista definiu vale mais que a conta automática).
export function metasDoPlano(p: PlanoAlimentar | null | undefined): { calories: number; protein: number; carbs: number; fat: number } | null {
  const t = p?.totais;
  if (!t || !(t.kcal > 0)) return null;
  return { calories: Math.round(t.kcal), protein: Math.round(t.proteina), carbs: Math.round(t.carbo), fat: Math.round(t.gordura) };
}
