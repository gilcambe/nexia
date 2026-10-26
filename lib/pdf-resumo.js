import { gerarIntervalosPaginas } from './utils/pdfChunker.js';

export async function pdfjs() {
  const lib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  lib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.min.mjs';
  return lib;
}

/**
 * Módulo para processamento de PDF com resumo e perguntas/respostas
 * 
 * Funcionalidades:
 * - Carrega PDF usando pdfjs-dist no navegador
 * - Divide o PDF em chunks de até 10 páginas
 * - Envia cada chunk para o RAG engine para resumo
 * - Gera perguntas e respostas para cada chunk
 * - Valida tamanho máximo do arquivo (10MB)
 * 
 * Formato esperado pelo RAG engine:
 * - Cada chunk é processado individualmente
 * - O contexto é acumulado dentro de cada chamada
 * - O RAG engine deve retornar um resumo do contexto fornecido
 * 
 * Exemplo de uso:
 * ```javascript
 * // Para apenas resumos
 * const summaries = await summarizePdf(pdfFile, 'tenant-123');
 * 
 * // Para resumos e perguntas/respostas
 * const result = await processPdfWithQA(pdfFile, 'tenant-123', 5);
 * ```
 */

export async function summarizePdf(file, tenantId) {
  // Validação de segurança
  if (!file || !(file instanceof File)) {
    throw new Error('Arquivo inválido: deve ser uma instância de File');
  }
  
  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
    throw new Error('TenantId inválido: deve ser uma string não vazia');
  }
  
  // Validação de tamanho do arquivo (limite: 10MB)
  const maxSizeBytes = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSizeBytes) {
    throw new Error(`Arquivo muito grande: ${Math.round(file.size / 1024 / 1024)}MB. Tamanho máximo permitido: 10MB`);
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
        const res = await fetch(window.location.origin + '/api/rag', {
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
        // Truncar texto para não expor conteúdo sensível nos logs
        const textoTruncado = textoChunk.length > 100 ? textoChunk.substring(0, 100) + '...' : textoChunk;
        console.error(`Erro ao processar chunk (páginas ${inicio}-${fim}):`, error.message);
        console.debug('Conteúdo truncado:', textoTruncado);
        summary = `Resumo da parte (páginas ${inicio}-${fim}): Erro ao processar via RAG engine.`;
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

/**
 * Gera perguntas e respostas para cada chunk do PDF
 * @param {Array<{chunkIndex: number, summary: string, pagesRange: string}>} chunks - Array de chunks processados
 * @param {string} tenantId - ID do tenant
 * @param {number} numPerguntas - Número de perguntas por chunk (padrão: 5)
 * @returns {Promise<Array<{chunkIndex: number, questions: Array<{question: string, answer: string, isCorrect: boolean}>, pagesRange: string}>>} Array de perguntas e respostas
 */
export async function generateQAForChunks(chunks, tenantId, numPerguntas = 5) {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    throw new Error('Chunks inválido: deve ser um array não vazio');
  }
  
  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
    throw new Error('TenantId inválido: deve ser uma string não vazia');
  }
  
  const resultados = [];
  
  for (const chunk of chunks) {
    const questions = [];
    
    // Gerar perguntas para este chunk
    for (let i = 0; i < numPerguntas; i++) {
      try {
        const res = await fetch(window.location.origin + '/api/rag', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Id': tenantId.trim()
          },
          body: JSON.stringify({
            tenantId: tenantId.trim(),
            query: `Crie uma pergunta sobre o conteúdo a seguir. A pergunta deve ser específica e testar o entendimento do conteúdo. Pergunta ${i + 1} de ${numPergunas}:`,
            context: chunk.summary
          })
        });
        
        if (res.ok) {
          const data = await res.json();
          const question = data.summary || data.answer || data.result || `Pergunta ${i + 1}`;
          
          // Obter resposta para a pergunta
          const answerRes = await fetch(window.location.origin + '/api/rag', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Tenant-Id': tenantId.trim()
            },
            body: JSON.stringify({
              tenantId: tenantId.trim(),
              query: `Responda à seguinte pergunta com base no conteúdo fornecido: ${question}`,
              context: chunk.summary
            })
          });
          
          let answer = '';
          if (answerRes.ok) {
            const answerData = await answerRes.json();
            answer = answerData.summary || answerData.answer || answerData.result || 'Resposta não disponível';
          }
          
          questions.push({
            question,
            answer,
            isCorrect: true // Simplificado: em um sistema real, validaria a resposta
          });
        } else {
          throw new Error(`Erro ao gerar pergunta: ${res.status}`);
        }
      } catch (error) {
        console.error(`Erro ao gerar pergunta ${i + 1} para chunk ${chunk.chunkIndex}:`, error.message);
        questions.push({
          question: `Pergunta ${i + 1} (erro ao gerar)`,
          answer: 'Erro ao gerar resposta',
          isCorrect: false
        });
      }
    }
    
    resultados.push({
      chunkIndex: chunk.chunkIndex,
      questions,
      pagesRange: chunk.pagesRange
    });
  }
  
  return resultados;
}

/**
 * Função principal para processar PDF, gerar resumos e perguntas/respostas
 * @param {File} file - Arquivo PDF a ser processado
 * @param {string} tenantId - ID do tenant
 * @param {number} numPerguntas - Número de perguntas por chunk (padrão: 5)
 * @returns {Promise<{summaries: Array, qa: Array}>} Objeto com resumos e perguntas/respostas
 */
export async function processPdfWithQA(file, tenantId, numPerguntas = 5) {
  const summaries = await summarizePdf(file, tenantId);
  const qa = await generateQAForChunks(summaries, tenantId, numPerguntas);
  return { summaries, qa };
}
