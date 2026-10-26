import { gerarIntervalosPaginas } from './utils/pdfChunker.js';

export async function pdfjs() {
  const lib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  lib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.min.mjs';
  return lib;
}

export async function summarizePdf(file, tenantId) {
  // Validação de segurança
  if (!file || !(file instanceof File)) {
    throw new Error('Arquivo inválido: deve ser uma instância de File');
  }
  
  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
    throw new Error('TenantId inválido: deve ser uma string não vazia');
  }

  const lib = await pdfjs();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const totalPaginas = doc.numPages;
  const intervalos = gerarIntervalosPaginas(totalPaginas, 10);
  const resultados = [];

  for (let i = 0; i < intervalos.length; i++) {
    const { inicio, fim } = intervalos[i];
    let textoChunk = '';
    
    try {
      // Extração de texto das páginas
      for (let p = inicio; p <= fim; p++) {
        const pg = await doc.getPage(p);
        const tc = await pg.getTextContent();
        const itens = (tc.items || []).map((it) => it.str || '').join(' ');
        textoChunk += `Página ${p}:\n${itens}\n\n`;
      }

      // Envio para o RAG engine
      let summary = '';
      try {
        const res = await fetch('/api/rag', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Id': tenantId.trim()
          },
          body: JSON.stringify({
            tenantId: tenantId.trim(),
            query: `Resuma o seguinte conteúdo da parte correspondente às páginas ${inicio} a ${fim}:`,
            context: textoChunk
          })
        });
        
        if (res.ok) {
          const data = await res.json();
          summary = data.summary || data.answer || data.result || JSON.stringify(data);
        } else {
          throw new Error(`Erro na API RAG: ${res.status}`);
        }
      } catch (error) {
        console.error('Erro ao processar chunk:', error);
        summary = `Resumo da parte (páginas ${inicio}-${fim}): ${textoChunk.slice(0, 300)}...`;
      }

      resultados.push({
        chunkIndex: i,
        summary,
        pagesRange: `${inicio}-${fim}`
      });
    } catch (error) {
      console.error(`Erro ao processar páginas ${inicio}-${fim}:`, error);
      resultados.push({
        chunkIndex: i,
        summary: `Erro ao processar páginas ${inicio}-${fim}: ${error.message}`,
        pagesRange: `${inicio}-${fim}`
      });
    }
  }

  return resultados;
}
