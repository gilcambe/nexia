// Lê o arquivo que o aluno ou o profissional enviou e devolve as avaliações encontradas.
// PDF: pdf.js (gratuito, roda no celular). Foto ou PDF escaneado: OCR com Tesseract.js
// (gratuito, roda no aparelho). Página salva (.mht/.html) e planilha (.csv) são lidas direto.
// As bibliotecas só são baixadas quando alguém importa um arquivo.
import { htmlDoMht, lerCsv, lerHtml, lerItens, lerTextoLivre, unirPorData, type Importado, type ItemTexto } from './importar.ts';

type Progresso = (msg: string) => void;

async function pdfjs() {
  const lib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
  lib.GlobalWorkerOptions.workerSrc = worker.default;
  return lib;
}

async function ocr(imagens: (Blob | HTMLCanvasElement)[], aviso: Progresso): Promise<string> {
  aviso('Lendo a imagem (pode levar alguns segundos na primeira vez)...');
  const { createWorker } = await import('tesseract.js');
  const w = await createWorker('por');
  try {
    let texto = '';
    for (const img of imagens) {
      const r = await w.recognize(img);
      texto += `${r.data.text}\n`;
    }
    return texto;
  } finally {
    await w.terminate();
  }
}

async function lerPdf(arquivo: File, aviso: Progresso): Promise<Importado> {
  aviso('Abrindo o PDF...');
  const lib = await pdfjs();
  const doc = await lib.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
  const paginas: { itens: ItemTexto[]; largura: number }[] = [];
  let letras = 0;
  for (let i = 1; i <= Math.min(doc.numPages, 6); i += 1) {
    const pg = await doc.getPage(i);
    const vp = pg.getViewport({ scale: 1 });
    const tc = await pg.getTextContent();
    const itens = (tc.items as { str?: string; transform?: number[] }[])
      .filter((it) => it.str && it.transform)
      .map((it) => ({ str: it.str as string, x: it.transform![4], y: vp.height - it.transform![5] }));
    letras += itens.reduce((a, it) => a + it.str.trim().length, 0);
    paginas.push({ itens, largura: vp.width });
  }
  if (letras > 40) return lerItens(paginas, arquivo.name);

  // PDF escaneado (só imagem): desenha as páginas e lê com OCR.
  const telas: HTMLCanvasElement[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, 3); i += 1) {
    const pg = await doc.getPage(i);
    const vp = pg.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width;
    canvas.height = vp.height;
    await pg.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
    telas.push(canvas);
  }
  return lerTextoLivre(await ocr(telas, aviso), arquivo.name);
}

// Só referência: o seletor não filtra, porque Android/iPhone apagam o .mht quando há filtro.
export const ACEITOS = '.pdf,.mht,.mhtml,.html,.htm,.csv,.txt,image/*,application/pdf,text/csv,text/html';

export async function lerArquivo(arquivo: File, aviso: Progresso = () => {}): Promise<Importado> {
  const nome = arquivo.name.toLowerCase();
  const tipo = arquivo.type;
  if (tipo === 'application/pdf' || nome.endsWith('.pdf')) return lerPdf(arquivo, aviso);
  if (tipo.startsWith('image/')) return lerTextoLivre(await ocr([arquivo], aviso), arquivo.name);
  const texto = await arquivo.text();
  if (nome.endsWith('.mht') || nome.endsWith('.mhtml') || /^MIME-Version:/im.test(texto.slice(0, 2000))) {
    return lerHtml(htmlDoMht(texto), arquivo.name);
  }
  if (nome.endsWith('.html') || nome.endsWith('.htm') || /<html|<table/i.test(texto.slice(0, 5000))) return lerHtml(texto, arquivo.name);
  if (nome.endsWith('.csv') || tipo === 'text/csv') return lerCsv(texto, arquivo.name);
  return lerTextoLivre(texto, arquivo.name);
}

// Vários arquivos de uma vez (ex.: PDF da balança + relatório do nutricionista).
export async function lerArquivos(arquivos: File[], aviso: Progresso = () => {}): Promise<Importado> {
  const todos: Importado[] = [];
  for (const a of arquivos) {
    try {
      todos.push(await lerArquivo(a, aviso));
    } catch (e) {
      todos.push({ formato: a.name, avaliacoes: [], avisos: [`Não consegui abrir ${a.name}: ${e instanceof Error ? e.message : 'erro'}`] });
    }
  }
  return {
    formato: Array.from(new Set(todos.map((t) => t.formato))).join(' + '),
    avaliacoes: unirPorData(todos.flatMap((t) => t.avaliacoes)),
    avisos: todos.flatMap((t) => t.avisos),
  };
}
