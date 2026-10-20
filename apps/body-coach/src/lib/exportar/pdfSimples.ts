// Gerador de PDF de texto, sem biblioteca (grátis e leve): fontes padrão do PDF (Helvetica), páginas A4,
// quebra de linha automática, faixa de título colorida e rodapé com número da página.

export interface LinhaPdf { texto: string; tam?: number; negrito?: boolean; cinza?: boolean; antes?: number; recuo?: number }

const A4 = { w: 595, h: 842 };
const MARGEM = 44;
const ESPECIAIS: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c,
  'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b,
  'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
};
const TROCAS: Record<string, string> = { '→': '->', '←': '<-', '≥': '>=', '≤': '<=', '✓': 'v', '✔': 'v', '●': '•', '○': 'o' };

// Texto -> bytes WinAnsi (o que as fontes padrão do PDF entendem). Emoji e símbolos fora da tabela somem.
export function paraWinAnsi(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    const t = TROCAS[ch];
    if (t) { for (const c of t) out.push(c.charCodeAt(0)); continue; }
    const cp = ch.codePointAt(0) ?? 63;
    if (ESPECIAIS[ch]) out.push(ESPECIAIS[ch]);
    else if ((cp >= 32 && cp < 127) || (cp >= 160 && cp < 256)) out.push(cp);
    else if (cp === 9) out.push(32);
  }
  // espaços duplos que sobram de emoji tirado
  return out.filter((c, i) => !(c === 32 && out[i - 1] === 32));
}

// Largura aproximada da Helvetica (média por tipo de letra), boa o bastante para quebrar linhas.
function largura(bytes: number[], tam: number, negrito: boolean): number {
  let u = 0;
  for (const c of bytes) {
    const ch = String.fromCharCode(c);
    if (c === 32) u += 0.278;
    else if ('iIjl.,:;\'|!'.includes(ch)) u += 0.24;
    else if ('ftr()[]-'.includes(ch)) u += 0.34;
    else if ('mwMW@'.includes(ch)) u += 0.86;
    else if (c >= 65 && c <= 90) u += 0.68;
    else u += 0.56;
  }
  return u * tam * (negrito ? 1.06 : 1);
}

function quebrar(bytes: number[], tam: number, negrito: boolean, max: number): number[][] {
  if (largura(bytes, tam, negrito) <= max) return [bytes];
  const linhas: number[][] = [];
  let atual: number[] = [];
  let palavra: number[] = [];
  const fecharPalavra = () => {
    const tentativa = atual.length ? [...atual, 32, ...palavra] : palavra;
    if (largura(tentativa, tam, negrito) <= max || !atual.length) atual = tentativa;
    else { linhas.push(atual); atual = palavra; }
    palavra = [];
  };
  for (const c of bytes) { if (c === 32) fecharPalavra(); else palavra.push(c); }
  fecharPalavra();
  if (atual.length) linhas.push(atual);
  return linhas;
}

const esc = (bytes: number[]) => bytes.map((c) => (c === 40 || c === 41 || c === 92 ? `\\${String.fromCharCode(c)}` : String.fromCharCode(c))).join('');

export function gerarPdf(titulo: string, subtitulo: string, linhas: LinhaPdf[], rodape = 'Feito com Body Coach'): Blob {
  const paginas: string[] = [];
  let ops: string[] = [];
  let y = 0;
  const util = A4.w - MARGEM * 2;
  const novaPagina = (primeira: boolean) => {
    if (ops.length) paginas.push(ops.join('\n'));
    ops = [];
    if (primeira) {
      ops.push('0.902 0.384 0.169 rg', `0 ${A4.h - 92} ${A4.w} 92 re f`, '1 1 1 rg');
      const t = quebrar(paraWinAnsi(titulo), 20, true, util)[0] ?? [];
      ops.push(`BT /F2 20 Tf ${MARGEM} ${A4.h - 50} Td (${esc(t)}) Tj ET`);
      if (subtitulo) ops.push(`BT /F1 10.5 Tf ${MARGEM} ${A4.h - 72} Td (${esc(quebrar(paraWinAnsi(subtitulo), 10.5, false, util)[0] ?? [])}) Tj ET`);
      ops.push('0 0 0 rg');
      y = A4.h - 120;
    } else {
      y = A4.h - MARGEM - 10;
    }
  };
  novaPagina(true);
  for (const l of linhas) {
    const tam = l.tam ?? 10.5;
    const neg = !!l.negrito;
    const recuo = l.recuo ?? 0;
    y -= l.antes ?? 0;
    for (const parte of quebrar(paraWinAnsi(l.texto), tam, neg, util - recuo)) {
      const alt = tam * 1.4;
      if (y - alt < MARGEM + 20) novaPagina(false);
      y -= alt;
      ops.push(`${l.cinza ? '0.42 0.45 0.5' : '0.07 0.09 0.12'} rg`, `BT /${neg ? 'F2' : 'F1'} ${tam} Tf ${MARGEM + recuo} ${y.toFixed(1)} Td (${esc(parte)}) Tj ET`);
    }
  }
  paginas.push(ops.join('\n'));

  const total = paginas.length;
  const objs: string[] = [];
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  const kids: string[] = [];
  paginas.forEach((conteudo, i) => {
    const pag = 5 + i * 2;
    const rod = esc(paraWinAnsi(`${rodape}  ·  ${i + 1}/${total}`));
    const fluxo = `${conteudo}\n0.55 0.58 0.62 rg BT /F1 8 Tf ${MARGEM} 24 Td (${rod}) Tj ET`;
    objs[pag] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.w} ${A4.h}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pag + 1} 0 R >>`;
    objs[pag + 1] = `<< /Length ${fluxo.length} >>\nstream\n${fluxo}\nendstream`;
    kids.push(`${pag} 0 R`);
  });
  objs[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${total} >>`;

  let saida = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets: number[] = [];
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = saida.length;
    saida += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = saida.length;
  saida += `xref\n0 ${objs.length}\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  saida += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  // cada caractere já é um byte (0-255)
  const bytes = new Uint8Array(saida.length);
  for (let i = 0; i < saida.length; i++) bytes[i] = saida.charCodeAt(i) & 255;
  return new Blob([bytes], { type: 'application/pdf' });
}
