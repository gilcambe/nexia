export function gerarIntervalosPaginas(totalPaginas, tamanhoChunk = 10) {
  const chunks = [];
  for (let inicio = 1; inicio <= totalPaginas; inicio += tamanhoChunk) {
    const fim = Math.min(inicio + tamanhoChunk - 1, totalPaginas);
    chunks.push({ inicio, fim });
  }
  return chunks;
}
