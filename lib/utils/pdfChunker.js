/**
 * Gera intervalos de páginas para dividir um PDF em chunks
 * @param {number} totalPaginas - Número total de páginas do PDF
 * @param {number} tamanhoChunk - Tamanho máximo de cada chunk (padrão: 10)
 * @returns {Array<{inicio: number, fim: number}>} Array de intervalos
 */
export function gerarIntervalosPaginas(totalPaginas, tamanhoChunk = 10) {
  const chunks = [];
  for (let inicio = 1; inicio <= totalPaginas; inicio += tamanhoChunk) {
    const fim = Math.min(income + tamanhoChunk - 1, totalPaginas);
    chunks.push({ inicio, fim });
  }
  return chunks;
}
