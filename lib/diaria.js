/**
 * Calcula o valor total de uma locação por diárias.
 *
 * @param {number} precoBase - preço base da diária (valor unitário).
 * @param {string[]} datas - array de strings no formato AAAA-MM-DD.
 * @returns {string} total formatado com duas casas decimais.
 * @throws {Error} se precoBase for negativo ou se a lista de datas estiver vazia.
 */
function calculaDiaria(precoBase, datas) {
  if (typeof precoBase !== 'number' || precoBase < 0) {
    throw new Error('Preço base inválido ou negativo');
  }

  if (!Array.isArray(datas) || datas.length === 0) {
    throw new Error('Lista de datas vazia');
  }

  let total = 0;

  for (const dataStr of datas) {
    const date = new Date(dataStr);
    if (isNaN(date)) {
      throw new Error(`Data inválida: ${dataStr}`);
    }
    const diaSemana = date.getUTCDay(); // 0 = domingo, 6 = sábado
    const isFimDeSemana = diaSemana === 0 || diaSemana === 6;
    const valorDiaria = isFimDeSemana ? precoBase * 1.3 : precoBase;
    total += valorDiaria;
  }

  if (datas.length >= 3) {
    total *= 0.9; // aplica 10% de desconto
  }

  return total.toFixed(2);
}

module.exports = calculaDiaria;
