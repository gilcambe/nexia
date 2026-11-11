'use strict';

/**
 * Soma n dias úteis a partir de uma data, ignorando fins de semana (sábado e domingo)
 * e feriados fornecidos.
 *
 * @param {string} data - Data inicial no formato "AAAA-MM-DD".
 * @param {number} n - Número de dias úteis a somar (n >= 0).
 * @param {string[]} [feriados=[]] - Array de datas de feriados no mesmo formato.
 * @returns {string} Data resultante no formato "AAAA-MM-DD".
 */
function somarDiasUteis(data, n, feriados = []) {
  // Caso trivial
  if (n === 0) {
    return data;
  }

  // Converte a data inicial para timestamp UTC (meia-noite)
  const [ano, mes, dia] = data.split('-').map(Number);
  let timestamp = Date.UTC(ano, mes - 1, dia); // meses são base 0

  // Cria um Set para busca rápida de feriados
  const feriadosSet = new Set(feriados);

  // Loop até consumir todos os dias úteis a serem adicionados
  while (n > 0) {
    // Avança um dia (em milissegundos)
    timestamp += 24 * 60 * 60 * 1000;

    const d = new Date(timestamp);
    const diaSemana = d.getUTCDay(); // 0 = domingo, 6 = sábado

    // Formata a data corrente para comparação com feriados
    const anoCur = d.getUTCFullYear();
    const mesCur = String(d.getUTCMonth() + 1).padStart(2, '0');
    const diaCur = String(d.getUTCDate()).padStart(2, '0');
    const dataFmt = `${anoCur}-${mesCur}-${diaCur}`;

    // Verifica se é dia útil
    const isFimDeSemana = diaSemana === 0 || diaSemana === 6;
    const isFeriado = feriadosSet.has(dataFmt);

    if (!isFimDeSemana && !isFeriado) {
      n--;
    }
  }

  // Formata a data final
  const finalDate = new Date(timestamp);
  const anoFinal = finalDate.getUTCFullYear();
  const mesFinal = String(finalDate.getUTCMonth() + 1).padStart(2, '0');
  const diaFinal = String(finalDate.getUTCDate()).padStart(2, '0');

  return `${anoFinal}-${mesFinal}-${diaFinal}`;
}

module.exports = { somarDiasUteis };
