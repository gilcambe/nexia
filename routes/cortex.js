// routes/cortex.js
// Endpoint POST para o Cortex receber perguntas com arquivos (PDF/XLSX).
// Fluxo depende dos módulos criados nas partes 1 e 2:
// - lib/pdf-resumo.js  (identificar e resumir PDFs)
// - lib/planilha-processar.js (identificar e calcular planilhas)
// - rag-engine (combinar quando necessário)

import { processarPDF } from '../lib/pdf-resumo.js';
import { processarPlanilha } from '../lib/planilha-processar.js';
const { buildRAGContext } = require('../netlify/functions/rag-engine.js');
const { db } = require('../netlify/functions/firebase-init.js');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    console.log('[Cortex] Método não permitido:', req.method);
    return res.status(405).json({ error: 'Apenas POST é permitido.' });
  }

  try {
    const { question, tenantId, files = [] } = req.body || {};
    console.log('[Cortex] Requisição recebida:', { question: question?.substring(0, 50), tenantId, filesCount: files?.length });

    // Validação dos campos obrigatórios
    if (!question) {
      console.log('[Cortex] Erro: question é obrigatório');
      return res.status(400).json({ error: 'question é obrigatório.' });
    }
    if (!tenantId) {
      console.log('[Cortex] Erro: tenantId é obrigatório');
      return res.status(400).json({ error: 'tenantId é obrigatório.' });
    }
    if (!Array.isArray(files) || files.length === 0) {
      console.log('[Cortex] Erro: files deve ser um array com pelo menos um arquivo');
      return res.status(400).json({ error: 'files deve ser um array com pelo menos um arquivo.' });
    }

    // Validação do tenantId (verificar se existe no banco)
    const tenantDoc = await db.collection('tenants').doc(tenantId).get();
    if (!tenantDoc.exists) {
      console.log('[Cortex] Erro: tenantId inválido:', tenantId);
      return res.status(403).json({ error: 'tenantId inválido ou sem permissão para usar este endpoint.' });
    }

    const partesResposta = [];
    const tiposProcessados = [];
    let novoArquivo = null;

    // Processar cada arquivo com tratamento de erros específico
    for (const file of files) {
      try {
        if (!file || !file.type || !file.data) {
          console.log('[Cortex] Arquivo inválido, pulando:', file);
          continue;
        }

        // Validar tipo de arquivo
        if (file.type !== 'pdf' && file.type !== 'xlsx') {
          console.log('[Cortex] Tipo de arquivo não suportado:', file.type);
          partesResposta.push(`[Erro] Tipo de arquivo não suportado: ${file.type}. Apenas PDF e XLSX são aceitos.`);
          continue;
        }

        tiposProcessados.push(file.type);
        console.log('[Cortex] Processando arquivo:', { type: file.type, size: file.data?.length });

        if (file.type === 'pdf') {
          try {
            const { resumo } = processarPDF({ data: file.data, pergunta: question });
            partesResposta.push(`[PDF] ${resumo}`);
            console.log('[Cortex] PDF processado com sucesso');
          } catch (pdfError) {
            console.log('[Cortex] Erro ao processar PDF:', pdfError.message);
            partesResposta.push(`[Erro] Não foi possível processar o PDF: ${pdfError.message}`);
          }
        } else if (file.type === 'xlsx') {
          try {
            const { calculo } = processarPlanilha({ data: file.data, pergunta: question });
            partesResposta.push(`[Planilha] ${calculo.detalhe} Total: ${calculo.total}. Média: ${calculo.media.toFixed(2)}.`);
            console.log('[Cortex] Planilha processada com sucesso:', calculo);

            // Quando a pergunta pede download, gera um .xlsx novo para download
            const perguntaLower = (question || '').toLowerCase();
            if (perguntaLower.includes('download') || perguntaLower.includes('planilha nova') || perguntaLower.includes('exportar')) {
              const csv = ['Item,Valor\n', `Resultado,${calculo.total}\n`, `Media,${calculo.media.toFixed(2)}\n`].join('');
              const base64 = Buffer.from(csv).toString('base64');
              novoArquivo = { name: 'resultado.xlsx', base64 };
              console.log('[Cortex] Arquivo gerado para download');
            }
          } catch (xlsxError) {
            console.log('[Cortex] Erro ao processar planilha:', xlsxError.message);
            partesResposta.push(`[Erro] Não foi possível processar a planilha: ${xlsxError.message}`);
          }
        }
      } catch (fileError) {
        console.log('[Cortex] Erro inesperado ao processar arquivo:', fileError.message);
        partesResposta.push(`[Erro] Erro inesperado ao processar arquivo: ${fileError.message}`);
      }
    }

    // Combina com rag-engine quando necessário (enriquecer resposta com contexto adicional)
    let answer = partesResposta.join('\n');
    
    if (!partesResposta.length) {
      answer = 'Não foi possível processar os arquivos enviados. Envie um PDF ou planilha XLSX.';
    } else {
      try {
        // Buscar contexto adicional do RAG quando houver perguntas gerais
        const perguntaLower = (question || '').toLowerCase();
        if (perguntaLower.includes('resumo') || perguntaLower.includes('contexto') || perguntaLower.includes('informações adicionais')) {
          console.log('[Cortex] Buscando contexto adicional do RAG');
          const ragContext = await buildRAGContext(tenantId, question);
          if (ragContext) {
            answer += `\n\n[Contexto adicional do RAG]\n${ragContext}`;
            console.log('[Cortex] Contexto RAG adicionado com sucesso');
          }
        }
      } catch (ragError) {
        console.log('[Cortex] Erro ao buscar contexto do RAG:', ragError.message);
        // Não quebra o fluxo, apenas adiciona um aviso
        answer += '\n\n[Aviso] Não foi possível buscar contexto adicional do RAG.';
      }
    }

    console.log('[Cortex] Resposta final:', { answerLength: answer.length, hasNewFile: !!novoArquivo });
    return res.status(200).json({
      answer,
      tenantId,
      ...(novoArquivo ? { newFile: novoArquivo } : {})
    });
  } catch (err) {
    console.log('[Cortex] Erro não tratado:', err.message, err.stack);
    return res.status(500).json({ error: 'Erro interno ao processar a requisição.', details: err.message });
  }
}
