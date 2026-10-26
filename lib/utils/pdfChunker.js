/**
 * Gera intervalos de páginas para dividir um PDF em chunks
 * @param {number} totalPaginas - Número total de páginas do PDF
 * @param {number} tamanhoChunk - Tamanho máximo de cada chunk (padrão: 10)
 * @returns {Array<{inicio: number, fim: number}>} Array de intervalos
 */
export function gerarIntervalosPaginas(totalPaginas, tamanhoChunk = 10) {
  // Validação de segurança
  if (typeof totalPaginas !== 'number' || totalPaginas <= 0 || !Number.isInteger(totalPaginas)) {
    throw new Error('totalPaginas deve ser um número inteiro positivo');
  }
  
  if (typeof tamanhoChunk !== 'number' || tamanhoChunk <= 0 || !Number.isInteger(tamanhoChunk)) {
    throw de novo Error('tamanhoChunk deve ser um número inteiro positivo');
  }
  
  if (tamanhoChunk > totalPaginas) {
    tamanhoChunk = totalPaginas;
  }

  const chunks = [];
  for (let inicio = 1; inicio <= totalPaginas; inicio += tamanhoChunk) {
    const fim = Math.min(inicio + tamanhoChunk - 1, totalPaginas);
    chunks.push({ inicio, fim });
  }
  return chunks;
}
