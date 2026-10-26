// lib/pdf-resumo.js
// Extrai texto de PDF (base64) e retorna resumo relevante para uma pergunta.
// Depende de módulos criados nas partes 1 e 2 (rag-engine e utilitários de leitura).

export function extrairTextoPDF(base64) {
  if (!base64) return '';
  try {
    // Suporte a data URL ou base64 puro
    const b64 = base64.includes(',') ? base64.split(',')[1] : base64;
    const bytes = atob(b64);
    // Simulação de extração de texto de PDF (sem bibliotecas externas, plano grátis)
    // Em produção com PDF.js ou similar, aqui faria o parse real.
    return Buffer.from(bytes, 'binary').toString('utf-8').replace(/[\x00-\x1F]+/g, ' ').trim();
  } catch (e) {
    return '';
  }
}

export function resumirRelevante(texto, pergunta) {
  if (!texto) return 'Não foi possível extrair texto do PDF.';
  if (!pergunta) return texto.slice(0, 2000);
  const linhas = texto.split(/\n+/).filter(l => l.trim().length > 0);
  const palavrasChave = pergunta.toLowerCase().split(/\s+/).filter(p => p.length > 2);
  const pontuadas = linhas.map(l => {
    const lower = l.toLowerCase();
    let score = 0;
    palavrasChave.forEach(p => { if (lower.includes(p)) score += 1; });
    return { linha: l, score };
  });
  pontuadas.sort((a, b) => b.score - a.score);
  const top = pontuadas.slice(0, 8).map(x => x.linha).join('\n');
  return top || linhas.slice(0, 5).join('\n');
}

export function processarPDF({ data, pergunta }) {
  const texto = extrairTextoPDF(data);
  const resumo = resumirRelevante(texto, pergunta);
  return { texto, resumo };
}
