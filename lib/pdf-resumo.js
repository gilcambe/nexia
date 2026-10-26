import { gerarIntervalosPaginas } from './utils/pdfChunker.js';

export async function pdfjs() {
  const lib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
  if (worker && worker.default) {
    lib.GlobalWorkerOptions.workerSrc = worker.default;
  }
  return lib;
}

export async function summarizePdf(file, tenantId) {
  const lib = await pdfjs();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const totalPaginas = doc.numPages;
  const intervalos = gerarIntervalosPaginas(totalPaginas, 10);
  const resultados = [];

  for (let i = 0; i < intervalos.length; i++) {
    const { inicio, fim } = intervalos[i];
    let textoChunk = '';
    for (let p = inicio; p <= fim; p++) {
      const pg = await doc.getPage(p);
      const tc = await pg.getTextContent();
      const itens = (tc.items || []).map((it) => it.str || '').join(' ');
      textoChunk += `Página ${p}:\n${itens}\n\n`;
    }

    let summary = '';
    try {
      const res = await fetch('/api/rag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(tenantId ? { 'X-Tenant-Id': tenantId } : {})
        },
        body: JSON.stringify({
          tenantId: tenantId || 'default',
          query: `Resuma o seguinte conteúdo da parte correspondente às páginas ${inicio} a ${fim}:`,
          context: textoChunk
        })
      });
      if (res.ok) {
        const data = await res.json();
        summary = data.summary || data.answer || data.result || JSON.stringify(data);
      } else {
        summary = `Resumo da parte (páginas ${inicio}-${fim}): ${textoChunk.slice(0, 300)}...`;
      }
    } catch {
      summary = `Resumo da parte (páginas ${inicio}-${fim}): ${textoChunk.slice(0, 300)}...`;
    }

    resultados.push({
      chunkIndex: i,
      summary
    });
  }

  return resultados;
}
