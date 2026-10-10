// Lê o PDF do plano alimentar no próprio celular (pdf.js, gratuito) e organiza com lerPlano.
import { pdfjs } from './avaliacao/lerArquivo';
import { lerPlano, type PlanoAlimentar, type TextoPdf } from './planoAlimentar';

export async function lerPlanoPdf(arquivo: File): Promise<PlanoAlimentar> {
  const lib = await pdfjs();
  const doc = await lib.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
  const paginas: { itens: TextoPdf[]; largura: number }[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, 20); i += 1) {
    const pg = await doc.getPage(i);
    const vp = pg.getViewport({ scale: 1 });
    const tc = await pg.getTextContent();
    const itens = (tc.items as { str?: string; transform?: number[] }[])
      .filter((it) => it.str && it.transform)
      .map((it) => ({ str: it.str as string, x: it.transform![4], y: vp.height - it.transform![5] }));
    paginas.push({ itens, largura: vp.width });
  }
  return lerPlano(paginas, arquivo.name);
}
