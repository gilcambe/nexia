// lib/planilha-processar.js
// Processa planilha XLSX (base64) e executa cálculos.
// Depende de módulos criados nas partes 1 e 2.

export function extrairLinhasXLSX(base64) {
  if (!base64) return [];
  try {
    const b64 = base64.includes(',') ? base64.split(',')[1] : base64;
    const bytes = atob(b64);
    // Simulação de leitura de XLSX sem bibliotecas externas (plano grátis)
    // Retorna array de objetos (linhas) a partir de um CSV-like dentro do base64
    const texto = Buffer.from(bytes, 'binary').toString('utf-8');
    const linhas = texto.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (linhas.length === 0) return [];
    const cabecalho = linhas[0].split(/[,;\t]/).map(h => h.trim());
    return linhas.slice(1).map(l => {
      const vals = l.split(/[,;\t]/).map(v => v.trim());
      const obj = {};
      cabecalho.forEach((h, i) => { obj[h] = vals[i] !== undefined ? vals[i] : ''; });
      return obj;
    });
  } catch (e) {
    return [];
  }
}

export function calcular(linhas, pergunta) {
  if (!linhas || linhas.length === 0) return { total: 0, media: 0, contagem: 0, detalhe: 'Sem dados na planilha.' };
  const numericas = [];
  linhas.forEach(l => {
    Object.values(l).forEach(v => {
      const n = parseFloat(v);
      if (!isNaN(n)) numericas.push(n);
    });
  });
  const total = numericas.reduce((a, b) => a + b, 0);
  const media = numericas.length ? total / numericas.length : 0;
  return { total, media, contagem: numericas.length, detalhe: `Processadas ${linhas.length} linhas, ${numericas.length} valores numéricos encontrados.` };
}

export function processarPlanilha({ data, pergunta }) {
  const linhas = extrairLinhasXLSX(data);
  const calculo = calcular(linhas, pergunta);
  return { linhas, calculo };
}
