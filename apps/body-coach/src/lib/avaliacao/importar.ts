// Importador de avaliações: transforma o conteúdo de um arquivo (PDF de balança, relatório de
// nutricionista salvo como página/MHT, planilha CSV ou texto lido de uma foto) em avaliações
// com cada número no campo certo. Puro: quem lê o arquivo (pdf.js, OCR) fica em lerArquivo.ts.
import { CAMPO_POR_KEY, campoDoRotulo, normalizar, type Grupo } from './campos.ts';
import type { Avaliacao, Segmental, Segmento, Sexo } from './calculos.ts';

export interface ItemTexto {
  str: string;
  x: number;
  y: number; // de cima para baixo
}

export interface Importado {
  formato: string;
  avaliacoes: Avaliacao[];
  avisos: string[];
}

// ── números e datas ──────────────────────────────────────────────────
export function lerNumero(t: string): number | null {
  const s = t.trim().replace(/\s*(kg|cm|mm|%|kcal|kj|anos|l)$/i, '').trim();
  if (!/^-?\d{1,3}(\.\d{3})+(,\d+)?$|^-?\d+([.,]\d+)?$/.test(s)) return null;
  const limpo = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) && !/^\d\.\d{3}$/.test(s)
    ? s.replace(/\./g, '').replace(',', '.')
    : s.replace(',', '.');
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

const RE_DATA = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b|\b(\d{4})-(\d{2})-(\d{2})\b/;
const RE_DATA_G = new RegExp(RE_DATA.source, 'g');

export function lerData(t: string): string | null {
  const m = RE_DATA.exec(t);
  if (!m) return null;
  let a: number; let mes: number; let d: number;
  if (m[4]) { a = +m[4]; mes = +m[5]; d = +m[6]; } else {
    d = +m[1]; mes = +m[2]; a = +m[3];
    if (a < 100) a += 2000;
  }
  if (mes < 1 || mes > 12 || d < 1 || d > 31 || a < 1990 || a > 2100) return null;
  return `${a}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function todasDatas(t: string): string[] {
  return (t.match(RE_DATA_G) ?? []).map(lerData).filter((d): d is string => !!d);
}

function noIntervalo(key: string, n: number): boolean {
  const c = CAMPO_POR_KEY[key];
  return !!c && n >= c.min && n <= c.max;
}

function lerSexo(texto: string): Sexo | null {
  const t = normalizar(texto);
  if (/\b(sexo|genero|gender)\s*:?\s*(m|masc|masculino|male|homem)\b/.test(t)) return 'M';
  if (/\b(sexo|genero|gender)\s*:?\s*(f|fem|feminino|female|mulher)\b/.test(t)) return 'F';
  const m = t.includes('masculino');
  const f = t.includes('feminino');
  if (m && !f) return 'M';
  if (f && !m) return 'F';
  return null;
}

// ── linhas a partir de itens posicionados ───────────────────────────
function emLinhas(itens: ItemTexto[]): ItemTexto[][] {
  const ord = [...itens].filter((i) => i.str.trim()).sort((a, b) => a.y - b.y || a.x - b.x);
  const linhas: ItemTexto[][] = [];
  for (const it of ord) {
    const ult = linhas[linhas.length - 1];
    if (ult && Math.abs(ult[0].y - it.y) <= 3.5) ult.push(it);
    else linhas.push([it]);
  }
  return linhas.map((l) => l.sort((a, b) => a.x - b.x));
}

// ── tabela com várias datas (relatório de evolução) ─────────────────
// Cada linha: rótulo seguido de um valor por data ("-" quando vazio). Setas e diferenças
// como "↓ (-2.4)" são ignoradas.
function celulasDeValores(resto: string): (number | null)[] {
  const limpo = resto.replace(/[↑↓▲▼]/g, ' ').replace(/\(\s*[+-]?\d+(?:[.,]\d+)?\s*\)/g, ' ');
  const out: (number | null)[] = [];
  for (const tok of limpo.split(/\s+/).filter(Boolean)) {
    if (/^[-–—]$/.test(tok)) out.push(null);
    else {
      const n = lerNumero(tok);
      if (n != null) out.push(n);
    }
  }
  return out;
}

function secaoDoTexto(t: string): Grupo | null | undefined {
  const n = normalizar(t);
  if (/bioimped/.test(n)) return 'bio';
  if (/dobras? cutanea|antropometric|medidas/.test(n)) return null;
  if (/circunferencia|perimetro/.test(n) && !/\d/.test(n)) return 'circ';
  return undefined;
}

function tabelaDeDatas(linhas: string[][], formato: string): Importado | null {
  // linhas: cada uma é uma lista de células (a primeira é o rótulo)
  let datas: string[] | null = null;
  let col0 = 1;
  const porData = new Map<string, Record<string, number>>();
  let secao: Grupo | null = null;
  const temBio = linhas.some((cel) => secaoDoTexto(cel.join(' ')) === 'bio');
  for (const cel of linhas) {
    const juntas = cel.join(' ');
    const ds = todasDatas(juntas);
    if (!datas && ds.length >= 2 && !lerData(cel[0] ?? '')) {
      datas = ds;
      col0 = Math.max(1, cel.findIndex((c) => !!lerData(c)));
      continue;
    }
    if (!datas) continue;
    const s = secaoDoTexto(juntas);
    if (s !== undefined && cel.filter((c) => c.trim()).length <= 1) { secao = s; continue; }
    const rotulo = cel[0] ?? '';
    let campo = campoDoRotulo(rotulo, secao);
    if (!campo) continue;
    // Num laudo com seção própria de bioimpedância, o "% de gordura" de antes dela é o das dobras.
    if (temBio && secao !== 'bio' && CAMPO_POR_KEY[`${campo.key}_laudo`]) campo = CAMPO_POR_KEY[`${campo.key}_laudo`];
    const valores = cel.length > 2 ? cel.slice(col0).map((c) => celulasDeValores(c)[0] ?? null) : celulasDeValores(cel.slice(1).join(' '));
    valores.slice(0, datas.length).forEach((n, i) => {
      if (n == null || !noIntervalo(campo.key, n)) return;
      const d = datas![i];
      const reg = porData.get(d) ?? {};
      if (reg[campo.key] == null) reg[campo.key] = n;
      porData.set(d, reg);
    });
  }
  if (!datas || porData.size === 0) return null;
  const avaliacoes: Avaliacao[] = [...porData.entries()]
    .filter(([, v]) => Object.keys(v).length > 0)
    .map(([data, valores]) => ({ data, valores, fonte: formato }));
  return { formato, avaliacoes: avaliacoes.sort((a, b) => a.data.localeCompare(b.data)), avisos: [] };
}

// Divide uma linha de texto em rótulo + valores ("Peso atual (Kg) 85.4 84.4 ↓ (-1) -").
function linhaEmCelulas(linha: string): string[] {
  const m = /^(.*?[A-Za-zÀ-ú)%²][^\d]*?)\s+((?:[-–—]|[↑↓]|\(?[+-]?\d+(?:[.,]\d+)?\)?)(?:\s+.*)?)$/.exec(linha.trim());
  if (!m) return [linha.trim()];
  return [m[1].trim(), m[2].trim()];
}

// ── avaliação única: rótulo e o número mais perto dele ──────────────
function valorPerto(itens: ItemTexto[], rot: ItemTexto, key: string, usados: Set<ItemTexto>): ItemTexto | null {
  const candidatos = itens
    .filter((i) => i !== rot && !usados.has(i))
    .map((i) => ({ i, n: lerNumero(i.str) }))
    .filter((c) => c.n != null && noIntervalo(key, c.n));
  const mesmaLinha = candidatos
    .filter((c) => Math.abs(c.i.y - rot.y) <= 8 && c.i.x > rot.x)
    .sort((a, b) => a.i.x - b.i.x);
  if (mesmaLinha[0] && mesmaLinha[0].i.x - rot.x < 260) return mesmaLinha[0].i;
  const abaixo = candidatos
    .filter((c) => c.i.y > rot.y && c.i.y - rot.y <= 16 && Math.abs(c.i.x - rot.x) <= 60)
    .sort((a, b) => a.i.y - b.i.y);
  return abaixo[0]?.i ?? null;
}

function segmentalTanita(itens: ItemTexto[], largura: number): Segmental | null {
  const topo = itens.find((i) => /analise segmental|segmental analysis/.test(normalizar(i.str)));
  if (!topo) return null;
  const fim = itens.find((i) => i.y > topo.y + 20 && /^(equilibrio|balance)$/.test(normalizar(i.str)));
  const ate = fim ? fim.y : topo.y + 220;
  const meio = largura / 2;
  const dentro = itens.filter((i) => i.y > topo.y && i.y < ate);
  const vals = (re: RegExp, lado: 'esq' | 'dir') => dentro
    .filter((i) => re.test(i.str.trim()) && (lado === 'esq' ? i.x < meio : i.x >= meio))
    .map((i) => ({ x: i.x, y: i.y, n: lerNumero(i.str.replace(/(kg|%)$/i, '')) as number }));
  const agrupar = (vs: { x: number; y: number; n: number }[]): Partial<Record<Segmento, number>> | undefined => {
    const ord = [...vs].sort((a, b) => a.y - b.y);
    const linhas: { x: number; y: number; n: number }[][] = [];
    for (const v of ord) {
      const u = linhas[linhas.length - 1];
      if (u && Math.abs(u[0].y - v.y) <= 10) u.push(v);
      else linhas.push([v]);
    }
    if (linhas.length < 3) return undefined;
    const [t, b, p] = linhas;
    const lr = (l: { x: number; n: number }[]) => [...l].sort((a, c) => a.x - c.x);
    const out: Partial<Record<Segmento, number>> = { tronco: t[0].n };
    const [be, bd] = lr(b);
    const [pe, pd] = lr(p);
    if (be) out.braco_e = be.n;
    if (bd) out.braco_d = bd.n;
    if (pe) out.perna_e = pe.n;
    if (pd) out.perna_d = pd.n;
    return out;
  };
  const seg: Segmental = {
    musculo_kg: agrupar(vals(/^\d+[.,]\d+\s*kg$/i, 'esq')),
    gordura_pct: agrupar(vals(/^\d+[.,]\d+\s*%$/, 'dir')),
    gordura_kg: agrupar(vals(/^\d+[.,]\d+\s*kg$/i, 'dir')),
  };
  return seg.musculo_kg || seg.gordura_pct ? seg : null;
}

function sexoPorMarcacao(itens: ItemTexto[]): Sexo | null {
  const m = itens.find((i) => /^masculino|^male$/.test(normalizar(i.str)));
  const f = itens.find((i) => /^feminino|^female$/.test(normalizar(i.str)));
  if (!m || !f) return null;
  const x = itens.find((i) => /^[x✓✔■●]$/i.test(i.str.trim()) && Math.abs(i.y - m.y) <= 6);
  if (!x) return null;
  return Math.abs(x.x - m.x) <= Math.abs(x.x - f.x) ? 'M' : 'F';
}

function detectarAparelho(texto: string): string {
  const t = normalizar(texto);
  if (t.includes('tanita')) return 'Balança Tanita';
  if (t.includes('inbody')) return 'InBody';
  if (t.includes('omron')) return 'Omron';
  if (t.includes('paciente.me')) return 'Relatório paciente.me';
  if (t.includes('dietbox')) return 'Dietbox';
  if (/bioimped|bia\b/.test(t)) return 'Bioimpedância';
  return 'Arquivo importado';
}

export function lerItens(paginas: { itens: ItemTexto[]; largura: number }[], nomeArquivo = ''): Importado {
  const todos = paginas.flatMap((p, pi) => p.itens.map((i) => ({ ...i, y: i.y + pi * 10000 })));
  const textoTodo = todos.map((i) => i.str).join(' ');
  const formato = detectarAparelho(`${textoTodo} ${nomeArquivo}`);

  // 1) Relatório de evolução (várias datas lado a lado)?
  const linhasTxt = emLinhas(todos).map((l) => l.map((i) => i.str).join(' ').replace(/\s+/g, ' '));
  const tabela = tabelaDeDatas(linhasTxt.map(linhaEmCelulas), formato);
  if (tabela && tabela.avaliacoes.length >= 2) return tabela;

  // 2) Avaliação única: cada rótulo pega o número ao lado.
  const valores: Record<string, number> = {};
  const usados = new Set<ItemTexto>();
  for (const pg of paginas) {
    const itens = pg.itens.filter((i) => i.str.trim());
    const ordem = [...itens].sort((a, b) => a.y - b.y || a.x - b.x);
    for (const rot of ordem) {
      // rótulo e número no mesmo pedaço de texto ("Peso: 84,7 kg")
      const junto = /^(.*?[A-Za-zÀ-ú%)])\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(kg|%|cm|mm|kcal|anos)?$/.exec(rot.str.trim());
      const campo = campoDoRotulo(junto ? junto[1] : rot.str);
      if (!campo || valores[campo.key] != null) continue;
      if (junto) {
        const n = lerNumero(junto[2]);
        if (n != null && noIntervalo(campo.key, n)) { valores[campo.key] = n; continue; }
      }
      const alvo = valorPerto(itens, rot, campo.key, usados);
      if (alvo) {
        valores[campo.key] = lerNumero(alvo.str) as number;
        usados.add(alvo);
      }
    }
  }
  // Texto corrido (sem posição útil): rótulo seguido de número na mesma linha.
  const porTexto = lerTextoLivre(linhasTxt.join('\n'), nomeArquivo);
  for (const [k, n] of Object.entries(porTexto.avaliacoes[0]?.valores ?? {})) if (valores[k] == null) valores[k] = n;

  const data = lerData(textoTodo);
  const hora = /\b(\d{1,2}):(\d{2})\b/.exec(textoTodo);
  const segmental = paginas.map((p) => segmentalTanita(p.itens, p.largura)).find(Boolean) ?? null;
  const sexo = sexoPorMarcacao(todos) ?? lerSexo(textoTodo);
  const avisos: string[] = [];
  if (!data) avisos.push('Não achei a data no arquivo: confira antes de salvar.');
  if (Object.keys(valores).length === 0) {
    return { formato, avaliacoes: [], avisos: ['Não encontrei medidas neste arquivo.'] };
  }
  return {
    formato,
    avaliacoes: [{ data: data ?? hojeIso(), hora: hora ? `${hora[1].padStart(2, '0')}:${hora[2]}` : null, sexo, valores, segmental, fonte: formato }],
    avisos,
  };
}

// ── texto livre (foto lida por OCR, .txt) ───────────────────────────
export function lerTextoLivre(texto: string, nomeArquivo = ''): Importado {
  const formato = detectarAparelho(`${texto} ${nomeArquivo}`);
  const linhas = texto.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const tabela = tabelaDeDatas(linhas.map(linhaEmCelulas), formato);
  if (tabela && tabela.avaliacoes.length >= 2) return tabela;
  const valores: Record<string, number> = {};
  let secao: Grupo | null = null;
  const re = /([A-Za-zÀ-ú][A-Za-zÀ-ú .()%/º°'-]*?)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(kg|%|cm|mm|kcal|anos)?(?=\s|$|[;|])/g;
  for (const l of linhas) {
    const s = secaoDoTexto(l);
    if (s !== undefined && !/\d/.test(l)) { secao = s; continue; }
    for (const m of l.matchAll(re)) {
      const campo = campoDoRotulo(m[1], secao);
      if (!campo || valores[campo.key] != null) continue;
      const n = lerNumero(m[2]);
      if (n != null && noIntervalo(campo.key, n)) valores[campo.key] = n;
    }
  }
  const data = lerData(texto);
  if (Object.keys(valores).length === 0) return { formato, avaliacoes: [], avisos: ['Não encontrei medidas no texto.'] };
  return {
    formato,
    avaliacoes: [{ data: data ?? hojeIso(), sexo: lerSexo(texto), valores, fonte: formato }],
    avisos: data ? [] : ['Não achei a data: confira antes de salvar.'],
  };
}

// ── HTML / MHT (página salva do sistema do nutricionista) ───────────
const ENT: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ordm: 'º', deg: '°', sup2: '²' };
function textoDoHtml(h: string): string {
  return h
    .replace(/<!--|-->/g, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z0-9]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

export function lerHtml(html: string, nomeArquivo = ''): Importado {
  const limpo = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  const textoTodo = textoDoHtml(limpo);
  const formato = detectarAparelho(`${textoTodo} ${nomeArquivo} ${/paciente\.me/i.test(html) ? 'paciente.me' : ''}`);
  const linhas: string[][] = [];
  // Linhas de tabela e títulos curtos, na ordem da página (os títulos marcam a seção).
  for (const m of limpo.matchAll(/<tr[\s\S]*?<\/tr>|<(div|h\d|caption|legend|p)\b[^>]*>([^<]{4,80})<\/\1>/gi)) {
    if (!/^<tr/i.test(m[0])) { linhas.push([textoDoHtml(m[2])]); continue; }
    const cel = (m[0].match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []).map(textoDoHtml);
    if (cel.length) linhas.push(cel);
  }
  const tabela = tabelaDeDatas(linhas, formato);
  if (tabela) return tabela;
  // Sem tabela de datas: lê como texto (uma avaliação).
  const blocos = limpo
    .replace(/<\/(tr|p|div|li|h\d)>/gi, '\n')
    .split('\n')
    .map(textoDoHtml)
    .filter(Boolean)
    .join('\n');
  return lerTextoLivre(blocos, nomeArquivo);
}

// Página salva como .mht/.mhtml: extrai a parte HTML (binária ou quoted-printable).
export function htmlDoMht(raw: string): string {
  const b = /boundary="?([^";\r\n]+)"?/i.exec(raw);
  const partes = b ? raw.split(`--${b[1]}`) : [raw];
  for (const p of partes) {
    const cab = p.slice(0, 1500);
    if (!/content-type:\s*text\/html/i.test(cab)) continue;
    const corpo = p.replace(/^[\s\S]*?\r?\n\r?\n/, '');
    if (/content-transfer-encoding:\s*quoted-printable/i.test(cab)) {
      const bytes = corpo.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
      try {
        return decodeURIComponent(escape(bytes));
      } catch {
        return bytes;
      }
    }
    return corpo;
  }
  return raw;
}

// ── CSV (exportação da balança ou planilha) ─────────────────────────
function separarCsv(linha: string, sep: string): string[] {
  const out: string[] = [];
  let atual = '';
  let aspas = false;
  for (const ch of linha) {
    if (ch === '"') aspas = !aspas;
    else if (ch === sep && !aspas) { out.push(atual.trim()); atual = ''; } else atual += ch;
  }
  out.push(atual.trim());
  return out;
}

export function lerCsv(texto: string, nomeArquivo = ''): Importado {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim());
  if (linhas.length < 2) return { formato: 'Planilha', avaliacoes: [], avisos: ['Planilha vazia.'] };
  const cab = linhas[0];
  const sep = [';', '\t', ','].sort((a, b) => cab.split(b).length - cab.split(a).length)[0];
  const tabela = linhas.map((l) => separarCsv(l, sep));
  const formato = detectarAparelho(`${texto.slice(0, 2000)} ${nomeArquivo}`) === 'Arquivo importado' ? 'Planilha' : detectarAparelho(texto.slice(0, 2000));
  // Datas no cabeçalho: cada coluna é uma avaliação.
  if (tabela[0].filter((c) => lerData(c)).length >= 1 && tabela[0].slice(1).every((c) => !c || lerData(c))) {
    const r = tabelaDeDatas(tabela, formato);
    if (r) return r;
  }
  // Senão cada linha é uma avaliação.
  const cols = tabela[0].map((h) => ({ h, campo: campoDoRotulo(h.replace(/\(.*?\)/g, ' ')) ?? campoDoRotulo(h) }));
  const colData = tabela[0].findIndex((h) => /data|date|dia/.test(normalizar(h)));
  const colSexo = tabela[0].findIndex((h) => /sexo|gender|genero/.test(normalizar(h)));
  const avaliacoes: Avaliacao[] = [];
  for (const row of tabela.slice(1)) {
    const valores: Record<string, number> = {};
    cols.forEach((c, i) => {
      if (!c.campo || i === colData) return;
      const n = lerNumero(row[i] ?? '');
      if (n != null && noIntervalo(c.campo.key, n) && valores[c.campo.key] == null) valores[c.campo.key] = n;
    });
    if (!Object.keys(valores).length) continue;
    const data = colData >= 0 ? lerData(row[colData] ?? '') ?? lerDataCompacta(row[colData] ?? '') : null;
    avaliacoes.push({ data: data ?? hojeIso(), sexo: colSexo >= 0 ? lerSexo(`sexo ${row[colSexo]}`) : null, valores, fonte: formato });
  }
  return {
    formato,
    avaliacoes: unirPorData(avaliacoes),
    avisos: avaliacoes.length ? [] : ['Não reconheci as colunas da planilha.'],
  };
}

// InBody exporta datas como 20260912103000.
function lerDataCompacta(t: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(t.trim());
  return m ? lerData(`${m[1]}-${m[2]}-${m[3]}`) : null;
}

// ── juntar ──────────────────────────────────────────────────────────
// Mesma data em dois arquivos (ex.: laudo da balança + dobras do nutricionista) vira uma avaliação.
export function unirPorData(lista: Avaliacao[]): Avaliacao[] {
  const mapa = new Map<string, Avaliacao>();
  for (const av of lista) {
    const atual = mapa.get(av.data);
    if (!atual) { mapa.set(av.data, { ...av, valores: { ...av.valores } }); continue; }
    for (const [k, n] of Object.entries(av.valores)) if (atual.valores[k] == null) atual.valores[k] = n;
    atual.sexo = atual.sexo ?? av.sexo;
    atual.hora = atual.hora ?? av.hora;
    atual.segmental = atual.segmental ?? av.segmental;
    if (av.fonte && atual.fonte && !atual.fonte.includes(av.fonte)) atual.fonte = `${atual.fonte} + ${av.fonte}`;
  }
  return [...mapa.values()].sort((a, b) => a.data.localeCompare(b.data));
}

export function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
