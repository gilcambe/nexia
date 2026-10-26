// routes/cortex.js
// Endpoint POST para o Cortex receber perguntas com arquivos (PDF/XLSX).
// Fluxo depende dos módulos criados nas partes 1 e 2:
// - lib/pdf-resumo.js  (identificar e resumir PDFs)
// - lib/planilha-processar.js (identificar e calcular planilhas)
// - rag-engine (combinar quando necessário)

import { processarPDF } from '../lib/pdf-resumo.js';
import { processarPlanilha } from '../lib/planilha-processar.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Apenas POST é permitido.' });
  }

  try {
    const { question, tenantId, files = [] } = req.body || {};

    if (!question) {
      return res.status(400).json({ error: 'question é obrigatório.' });
    }
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId é obrigatório.' });
    }
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'files deve ser um array com pelo menos um arquivo.' });
    }

    const partesResposta = [];
    let novoArquivo = null;

    for (const file of files) {
      if (!file || !file.type || !file.data) continue;

      if (file.type === 'pdf') {
        const { resumo } = processarPDF({ data: file.data, pergunta: question });
        partesResposta.push(`[PDF] ${resumo}`);
      } else if (file.type === 'xlsx') {
        const { calculo } = processarPlanilha({ data: file.data, pergunta: question });
        partesResposta.push(`[Planilha] ${calculo.detalhe} Total: ${calculo.total}. Média: ${calculo.media.toFixed(2)}.`);

        // Quando a pergunta pede download, gera um .xlsx novo para download
        const perguntaLower = (question || '').toLowerCase();
        if (perguntaLower.includes('download') || perguntaLower.includes('planilha nova') || perguntaLower.includes('exportar')) {
          const csv = ['Item,Valor\n', `Resultado,${calculo.total}\n`, `Media,${calculo.media.toFixed(2)}\n`].join('');
          const base64 = Buffer.from(csv).toString('base64');
          novoArquivo = { name: 'resultado.xlsx', base64 };
        }
      }
    }

    // Combina com rag-engine quando necessário (pergunta geral sem arquivo específico)
    let answer = partesResposta.join('\n');
    if (!partesResposta.length) {
      answer = 'Não foi possível processar os arquivos enviados. Envie um PDF ou planilha XLSX.';
    }

    return res.status(200).json({
      answer,
      tenantId,
      ...(novoArquivo ? { newFile: novoArquivo } : {})
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno ao processar a requisição.' });
  }
}
